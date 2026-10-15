-- Sponsored listings are ranked by price instead of a chosen spot (replaces the #1-#10 ladder).
--
-- * A buyer pays any whole-dollar amount from $1. All active listings are ranked by bid, highest
--   first; on a tie the one activated first stays ahead.
-- * There is no limit on how many are active, so nobody is pushed out or refunded for being outbid.
--   The homepage shows the top 10 and /sponsored shows them all.
-- * Each purchase lasts 30 days from activation. Buying again for the same product replaces its
--   earlier listing.
-- * `position` is no longer chosen; it records the rank at activation (the live rank is computed).
--
-- Run this once in the Supabase SQL editor (after premium_ladder_10.sql).

ALTER TABLE premium_listings DROP CONSTRAINT IF EXISTS premium_listings_position_check;
ALTER TABLE premium_listings ALTER COLUMN position DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_premium_listings_rank
  ON premium_listings(bid_usd DESC, activated_at ASC) WHERE payment_status = 'active';

CREATE OR REPLACE FUNCTION activate_premium_bid(p_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bid premium_listings%ROWTYPE;
  min_price CONSTANT NUMERIC := 1;   -- must match MIN_BID_USD in lib/premiumSpots.ts
  new_rank INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('premium_ladder'));

  SELECT * INTO bid FROM premium_listings WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF bid.payment_status <> 'pending' THEN
    -- Already handled (webhooks can be delivered more than once).
    RETURN jsonb_build_object('status', bid.payment_status, 'position', bid.position);
  END IF;

  IF COALESCE(bid.bid_usd, 0) < min_price THEN
    UPDATE premium_listings SET payment_status = 'needs_refund', updated_at = now() WHERE id = bid.id;
    RETURN jsonb_build_object('status', 'needs_refund', 'required', min_price);
  END IF;

  -- A product holds at most one listing: buying again gives up its current one.
  UPDATE premium_listings SET payment_status = 'replaced', updated_at = now()
   WHERE listing_id = bid.listing_id AND payment_status = 'active' AND id <> bid.id;

  UPDATE premium_listings
     SET payment_status = 'active', activated_at = now(), expires_at = now() + INTERVAL '30 days', updated_at = now()
   WHERE id = bid.id;

  -- Rank among live listings: higher bids first, earlier activation wins a tie.
  SELECT COUNT(*) + 1 INTO new_rank FROM premium_listings
   WHERE payment_status = 'active' AND expires_at > now() AND id <> bid.id
     AND (bid_usd > bid.bid_usd OR (bid_usd = bid.bid_usd AND activated_at <= now()));

  UPDATE premium_listings SET position = new_rank WHERE id = bid.id;

  RETURN jsonb_build_object('status', 'active', 'position', new_rank);
END;
$$;

REVOKE ALL ON FUNCTION activate_premium_bid(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION activate_premium_bid(TEXT) TO service_role;
