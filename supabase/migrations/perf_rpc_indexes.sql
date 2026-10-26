-- Performance (2026-10-26). Run with psql -f (not inside a transaction: the index changes are CONCURRENTLY).
-- The app keeps working without it: lib/server/rate-limit.ts and lib/visitor-tracking.ts fall back to the
-- older multi-request path when these functions are missing.

-- 1. One round trip per rate-limit check (was insert, count, then delete when over the limit).
--    The advisory lock serialises checks of the same key, so a parallel burst can't all count before inserting.
CREATE OR REPLACE FUNCTION public.rate_limit_hit(p_key text, p_limit integer, p_window_sec integer)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  hit_id bigint;
  hits integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_key, 0));
  INSERT INTO rate_limits (key) VALUES (p_key) RETURNING id INTO hit_id;
  SELECT count(*) INTO hits FROM rate_limits
    WHERE key = p_key AND created_at >= now() - make_interval(secs => p_window_sec);
  IF hits <= p_limit THEN
    RETURN true;
  END IF;
  -- A refused request doesn't count, so retrying while limited doesn't push the window further out.
  DELETE FROM rate_limits WHERE id = hit_id;
  RETURN false;
END;
$$;

-- 2. One round trip per page view (was: find session, update or insert it, read today's row, write it back).
--    The upserts are atomic, so concurrent page views no longer overwrite each other's increments.
CREATE OR REPLACE FUNCTION public.track_visit(p_session_id text, p_user_agent text, p_ip text, p_page_url text)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  is_new boolean;
  today date := (now() AT TIME ZONE 'utc')::date;
BEGIN
  INSERT INTO visitor_sessions (session_id, user_agent, ip_address, page_url, last_activity, is_active)
  VALUES (p_session_id, p_user_agent, p_ip, p_page_url, now(), true)
  ON CONFLICT (session_id) DO UPDATE
    SET last_activity = now(), page_url = EXCLUDED.page_url, is_active = true
  RETURNING (xmax = 0) INTO is_new;

  INSERT INTO visitor_analytics (date, total_visitors, unique_visitors, page_views)
  VALUES (today, CASE WHEN is_new THEN 1 ELSE 0 END, CASE WHEN is_new THEN 1 ELSE 0 END, 1)
  ON CONFLICT (date) DO UPDATE
    SET page_views = visitor_analytics.page_views + 1,
        total_visitors = visitor_analytics.total_visitors + CASE WHEN is_new THEN 1 ELSE 0 END;
  RETURN is_new;
END;
$$;

-- Server (service role) only, like every other object in this schema (lock_public_roles.sql).
REVOKE ALL ON FUNCTION public.rate_limit_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.track_visit(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.track_visit(text, text, text, text) TO service_role;

-- 3. Indexes for the hot queries.
-- "Today" rankings: ORDER BY day_votes DESC, rank_reached_at (the all-time order has listings_rank_idx).
CREATE INDEX CONCURRENTLY IF NOT EXISTS listings_today_rank_idx ON public.listings (day_votes DESC, rank_reached_at);
-- Each vote recounts the listing's votes since midnight: listing_id = ? AND voted_at >= ?.
CREATE INDEX CONCURRENTLY IF NOT EXISTS votes_listing_voted_at_idx ON public.votes (listing_id, voted_at);

-- Duplicates: each repeats another index exactly (or is its leading column), and costs a write on every
-- insert/update. None of them backs a constraint; the constraint indexes they duplicate stay.
DROP INDEX CONCURRENTLY IF EXISTS public.idx_listings_user_id;             -- = listings_user_id_idx
DROP INDEX CONCURRENTLY IF EXISTS public.idx_listings_day_votes;           -- leading column of listings_today_rank_idx
DROP INDEX CONCURRENTLY IF EXISTS public.idx_listings_total_votes;         -- leading column of listings_rank_idx
DROP INDEX CONCURRENTLY IF EXISTS public.idx_users_email;                  -- = users_email_key (unique)
DROP INDEX CONCURRENTLY IF EXISTS public.uq_votes_listing_voter;           -- = votes_listing_id_voter_id_key (unique)
DROP INDEX CONCURRENTLY IF EXISTS public.idx_votes_listing_id;             -- leading column of the unique index
DROP INDEX CONCURRENTLY IF EXISTS public.idx_visitor_sessions_session_id;  -- = visitor_sessions_session_id_key
DROP INDEX CONCURRENTLY IF EXISTS public.idx_waitlist_email;               -- = waitlist_email_key
DROP INDEX CONCURRENTLY IF EXISTS public.idx_visitor_analytics_date;       -- = visitor_analytics_date_key (read backwards)
