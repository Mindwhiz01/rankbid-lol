-- Queue order for ties: among listings with the same votes, the one that reached that count first ranks higher.
-- rank_reached_at is when the listing joined its current vote count (its submit time while it has no votes).
ALTER TABLE listings ADD COLUMN IF NOT EXISTS rank_reached_at timestamptz;

UPDATE listings l
SET rank_reached_at = CASE
  WHEN l.total_votes > 0 THEN COALESCE((SELECT max(v.voted_at) FROM votes v WHERE v.listing_id = l.id), l.created_at)
  ELSE l.created_at
END;

ALTER TABLE listings ALTER COLUMN rank_reached_at SET DEFAULT now();
UPDATE listings SET rank_reached_at = created_at WHERE rank_reached_at IS NULL;
ALTER TABLE listings ALTER COLUMN rank_reached_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS listings_rank_idx ON listings (total_votes DESC, rank_reached_at ASC);
