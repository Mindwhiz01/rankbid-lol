-- One-time password reset links. Only a SHA-256 hash of the token is stored, so a leaked
-- table can't be used to reset anyone's password. Rows are used once and expire after an hour.
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_resets_user_id_idx ON password_resets (user_id);

-- Server-only (service role); no access from the browser's anon key.
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
