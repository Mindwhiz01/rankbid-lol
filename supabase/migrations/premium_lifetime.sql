-- Sponsored listings last for life: one payment, no end date.
--
-- * activate_premium_bid leaves expires_at NULL; NULL means lifetime.
-- * Live listings are those with expires_at NULL or still in the future, so any dated
--   listing still runs out on its date.
-- * Active listings bought under the old 30-day terms become lifetime too.
--
-- Run after premium_rank_by_price.sql, and only once the app reading expires_at NULL as
-- lifetime is deployed (older code would hide NULL rows).

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
     SET payment_status = 'active', activated_at = now(), expires_at = NULL, updated_at = now()
   WHERE id = bid.id;

  -- Rank among live listings: higher bids first, earlier activation wins a tie.
  SELECT COUNT(*) + 1 INTO new_rank FROM premium_listings
   WHERE payment_status = 'active' AND (expires_at IS NULL OR expires_at > now()) AND id <> bid.id
     AND (bid_usd > bid.bid_usd OR (bid_usd = bid.bid_usd AND activated_at <= now()));

  UPDATE premium_listings SET position = new_rank WHERE id = bid.id;

  RETURN jsonb_build_object('status', 'active', 'position', new_rank);
END;
$$;

REVOKE ALL ON FUNCTION activate_premium_bid(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION activate_premium_bid(TEXT) TO service_role;

UPDATE premium_listings SET expires_at = NULL, updated_at = now()
 WHERE payment_status = 'active' AND expires_at > now();
