-- Admins can block an account: it can't sign in (password or Google), and every open session
-- stops working. Unblocking clears both columns.
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_reason text;
