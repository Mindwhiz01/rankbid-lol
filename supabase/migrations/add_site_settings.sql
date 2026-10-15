-- Site-wide switches the admin dashboard can flip (read and written only with the service role key).
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
-- No policies: anon and authenticated roles get nothing; the server uses the service role.

-- Coming soon page on for every visitor until an admin turns it off.
INSERT INTO site_settings (key, value) VALUES ('coming_soon', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;
