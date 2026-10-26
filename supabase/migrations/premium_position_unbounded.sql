-- Sponsored spots are unlimited (ranked by price), so a listing's rank can be past #10.
-- The old 1..10 check made $1 and $2 checkouts fail with a 500 once ten higher bids existed (QA RB-04),
-- and would have failed activate_premium_bid for any paid bid ranked #11 or lower.
ALTER TABLE premium_listings DROP CONSTRAINT IF EXISTS premium_listings_position_check;
ALTER TABLE premium_listings ADD CONSTRAINT premium_listings_position_check CHECK (position >= 1);
