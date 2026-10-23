-- Email signups must confirm their address before they can sign in. Accounts that existed before
-- this (and Google sign-ins, which Google has verified) count as verified.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
UPDATE users SET email_verified_at = COALESCE(created_at, now()) WHERE email_verified_at IS NULL;

-- One-time confirmation links. Only a SHA-256 hash of the token is stored.
CREATE TABLE IF NOT EXISTS email_verifications (
  token_hash text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_verifications_user_id_idx ON email_verifications (user_id);

-- Server-only (service role); no access from the browser's anon key.
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;
