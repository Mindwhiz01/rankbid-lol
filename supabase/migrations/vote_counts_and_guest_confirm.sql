-- QA round 3 (2026-10-29). Run with psql -f or in the Supabase SQL editor.

-- 1. RB-34: recount a listing's votes and save the totals in one locked step. Counting and then saving in
--    two requests let two simultaneous votes interleave, so a response (or the saved total) could be stale.
--    The row lock queues recounts of the same listing; each count then runs after the previous one saved,
--    so it sees every vote committed before it. The app falls back to the old path while this is missing.
--    The listing rejoins the queue at its new count (rank_reached_at); p_added also stamps updated_at.
CREATE OR REPLACE FUNCTION public.refresh_listing_counts(p_listing_id uuid, p_day_start timestamptz, p_added boolean)
RETURNS json
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  total integer;
  today integer;
BEGIN
  PERFORM 1 FROM listings WHERE id = p_listing_id FOR UPDATE;
  SELECT count(*) INTO total FROM votes WHERE listing_id = p_listing_id;
  SELECT count(*) INTO today FROM votes WHERE listing_id = p_listing_id AND voted_at >= p_day_start;
  UPDATE listings
     SET total_votes = total,
         day_votes = today,
         rank_reached_at = now(),
         updated_at = CASE WHEN p_added THEN now() ELSE updated_at END
   WHERE id = p_listing_id;
  RETURN json_build_object('total_votes', total, 'day_votes', today);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_listing_counts(uuid, timestamptz, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_listing_counts(uuid, timestamptz, boolean) TO service_role;

-- 2. RB-05: a guest vote from a /support link counts only after the voter clicks the link we email them.
--    Only a SHA-256 hash of the token is stored. One open request per voter and listing.
CREATE TABLE IF NOT EXISTS pending_support_votes (
  token_hash   text PRIMARY KEY,
  listing_id   uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  voter_id     text NOT NULL,
  name         text NOT NULL,
  email        text NOT NULL,
  support_type text NOT NULL CHECK (support_type IN ('founder', 'friend', 'supporter')),
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pending_support_votes_voter_idx ON pending_support_votes (listing_id, voter_id);

-- Server-only (service role), like every other table.
ALTER TABLE pending_support_votes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON pending_support_votes FROM anon, authenticated;
