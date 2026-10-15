-- Premium ladder grows from #1-#3 to #1-#10, every spot starting at $1, and listings count clicks.
--
-- * An empty spot costs $1. A held spot is taken by paying at least the holder's bid + $1.
-- * Taking a held spot pushes its holder down one spot, and so on until an empty spot is reached.
--   Whoever is pushed past #10 is marked 'outbid'.
-- * Each purchase lasts 30 days from activation; being pushed down does not change that date.
--
-- Run this once in the Supabase SQL editor (after premium_bidding.sql).

ALTER TABLE premium_listings DROP CONSTRAINT IF EXISTS premium_listings_position_check;
ALTER TABLE premium_listings ADD CONSTRAINT premium_listings_position_check CHECK (position BETWEEN 1 AND 10);

CREATE OR REPLACE FUNCTION activate_premium_bid(p_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bid premium_listings%ROWTYPE;
  holder premium_listings%ROWTYPE;
  required NUMERIC;
  base_price CONSTANT NUMERIC := 1;   -- must match BASE_PRICE_USD in lib/premiumSpots.ts
  spots CONSTANT INTEGER := 10;       -- must match PREMIUM_SPOTS in lib/premiumSpots.ts
  carry TEXT;
  displaced TEXT;
  i INTEGER;
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

  -- A product holds at most one spot: buying again gives up its current one.
  UPDATE premium_listings SET payment_status = 'replaced', updated_at = now()
   WHERE listing_id = bid.listing_id AND payment_status = 'active' AND id <> bid.id;

  SELECT * INTO holder FROM premium_listings
   WHERE payment_status = 'active' AND expires_at > now() AND position = bid.position;
  required := CASE WHEN FOUND THEN holder.bid_usd + 1 ELSE base_price END;

  IF COALESCE(bid.bid_usd, 0) < required THEN
    UPDATE premium_listings SET payment_status = 'needs_refund', updated_at = now() WHERE id = bid.id;
    RETURN jsonb_build_object('status', 'needs_refund', 'position', bid.position, 'required', required);
  END IF;

  -- Walk down from the bought spot, moving each holder one spot lower until an empty spot.
  carry := bid.id;
  FOR i IN bid.position..spots LOOP
    SELECT id INTO displaced FROM premium_listings
     WHERE payment_status = 'active' AND expires_at > now() AND position = i AND id <> carry;
    UPDATE premium_listings SET position = i, updated_at = now() WHERE id = carry;
    IF displaced IS NULL THEN
      carry := NULL;
      EXIT;
    END IF;
    carry := displaced;
    displaced := NULL;
  END LOOP;

  IF carry IS NOT NULL THEN
    UPDATE premium_listings SET payment_status = 'outbid', updated_at = now() WHERE id = carry;
  END IF;

  UPDATE premium_listings
     SET payment_status = 'active', activated_at = now(), expires_at = now() + INTERVAL '30 days', updated_at = now()
   WHERE id = bid.id;

  RETURN jsonb_build_object('status', 'active', 'position', bid.position);
END;
$$;

REVOKE ALL ON FUNCTION activate_premium_bid(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION activate_premium_bid(TEXT) TO service_role;

-- Outbound clicks per listing (counted by /api/click before it redirects to the product).
ALTER TABLE listings ADD COLUMN IF NOT EXISTS click_count INTEGER NOT NULL DEFAULT 0;
UPDATE listings SET click_count = 0 WHERE click_count IS NULL;

-- Returns the product URL to redirect to, or NULL if the listing does not exist.
CREATE OR REPLACE FUNCTION record_listing_click(p_id TEXT, p_count BOOLEAN DEFAULT TRUE)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target TEXT;
BEGIN
  IF p_count THEN
    UPDATE listings SET click_count = COALESCE(click_count, 0) + 1
     WHERE id::text = p_id
     RETURNING location INTO target;
  ELSE
    SELECT location INTO target FROM listings WHERE id::text = p_id;
  END IF;
  RETURN target;
END;
$$;

REVOKE ALL ON FUNCTION record_listing_click(TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION record_listing_click(TEXT, BOOLEAN) TO service_role;
