-- Audit trail of everything done from the admin dashboard: who (actor email), what (action),
-- on what (target) and the data involved (details: before/after values, or a full copy of
-- anything deleted). Append-only: the app never updates or deletes rows.
CREATE TABLE IF NOT EXISTS admin_activity (
  id         bigserial PRIMARY KEY,
  actor      text NOT NULL,
  action     text NOT NULL,
  target     text,
  details    jsonb,
  ip_hash    text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_activity_created_at_idx ON admin_activity (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_activity_actor_idx ON admin_activity (actor);

-- Server-only (service role); no access from the browser's anon key.
ALTER TABLE admin_activity ENABLE ROW LEVEL SECURITY;
