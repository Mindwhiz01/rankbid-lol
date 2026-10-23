// Server-only: account records for password changes, resets and account deletion (Supabase REST).
import { createHash, randomBytes } from 'crypto';
import bcryptjs from 'bcryptjs';
import { sbHeaders, sbUrl } from '@/lib/server/votes';

/** Accounts created with Google sign-in store this instead of a password hash. */
export const GOOGLE_PLACEHOLDER = 'google_oauth';

/** Accounts created by an admin invite store this until the invitee sets their own password. */
export const INVITE_PLACEHOLDER = 'admin_invite_pending';

/** Same rule as sign-up. Null when the password is fine. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters';
  if (password.length > 200) return 'Password is too long (200 characters max)';
  return null;
}

export interface AccountRow {
  id: string;
  email: string;
  name: string | null;
  password: string;
}

export async function getAccount(where: { id: string } | { email: string }): Promise<AccountRow | null> {
  const filter = 'id' in where ? `id=eq.${encodeURIComponent(where.id)}` : `email=eq.${encodeURIComponent(where.email.toLowerCase())}`;
  const res = await fetch(sbUrl(`users?${filter}&select=id,email,name,password`), { headers: sbHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error(`User lookup failed: ${res.status}`);
  const [row] = await res.json();
  return row ?? null;
}

/** True when `password` matches the account's (always false for a Google-only account). */
export async function passwordMatches(account: AccountRow, password: unknown): Promise<boolean> {
  if (typeof password !== 'string' || !password || account.password === GOOGLE_PLACEHOLDER || account.password === INVITE_PLACEHOLDER) return false;
  return bcryptjs.compare(password, account.password).catch(() => false);
}

export async function setPassword(userId: string, password: string): Promise<void> {
  const hash = await bcryptjs.hash(password, 10);
  const res = await fetch(sbUrl(`users?id=eq.${encodeURIComponent(userId)}`), {
    method: 'PATCH',
    headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify({ password: hash, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Password update failed: ${res.status} ${await res.text()}`);
}

/** Signs the account out everywhere, except the session `keepToken` (the browser making the change). */
export async function endSessions(userId: string, keepToken?: string): Promise<void> {
  const keep = keepToken ? `&token=neq.${encodeURIComponent(keepToken)}` : '';
  const res = await fetch(sbUrl(`sessions?user_id=eq.${encodeURIComponent(userId)}${keep}`), { method: 'DELETE', headers: sbHeaders() });
  if (!res.ok) throw new Error(`Ending sessions failed: ${res.status} ${await res.text()}`);
}

/**
 * Saves a one-time "choose a password" token for the account (password_resets table) and returns
 * the /reset-password link. Only the token's hash is stored; the raw token lives in the link alone.
 * `replaceUnused` drops the account's earlier unused links first, so only the newest one works.
 */
export async function createPasswordLink(
  userId: string,
  ttlMs: number,
  baseUrl: string,
  opts: { invite?: boolean; replaceUnused?: boolean } = {},
): Promise<string> {
  if (opts.replaceUnused) {
    await fetch(sbUrl(`password_resets?user_id=eq.${encodeURIComponent(userId)}&used_at=is.null`), { method: 'DELETE', headers: sbHeaders() });
  }
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const res = await fetch(sbUrl('password_resets'), {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify({ token_hash: tokenHash, user_id: userId, expires_at: new Date(Date.now() + ttlMs).toISOString() }),
  });
  if (!res.ok) throw new Error(`Saving password token failed: ${res.status} ${await res.text()}`);
  return `${baseUrl.replace(/\/+$/, '')}/reset-password?token=${token}${opts.invite ? '&invite=1' : ''}`;
}

/** Shown when a blocked account tries to sign in. */
export const BLOCKED_MESSAGE = 'This account has been blocked. If you think this is a mistake, contact support.';

/** True when an admin has blocked the account. False on any lookup error, so sign-in never breaks over it. */
export async function isBlocked(userId: string): Promise<boolean> {
  try {
    const res = await fetch(sbUrl(`users?id=eq.${encodeURIComponent(userId)}&select=*`), { headers: sbHeaders(), cache: 'no-store' });
    if (!res.ok) return false;
    const [row] = await res.json();
    return Boolean(row?.blocked_at);
  } catch {
    return false;
  }
}

// ---- Email verification (supabase/migrations/email_verification.sql) ----

/** How long a "confirm your email" link works. */
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

/** True once the account confirmed its email (or was created before verification existed). True on lookup errors, so sign-in never breaks over it. */
export async function isEmailVerified(userId: string): Promise<boolean> {
  try {
    const res = await fetch(sbUrl(`users?id=eq.${encodeURIComponent(userId)}&select=*`), { headers: sbHeaders(), cache: 'no-store' });
    if (!res.ok) return true;
    const [row] = await res.json();
    return !row || !('email_verified_at' in row) || Boolean(row.email_verified_at);
  } catch {
    return true;
  }
}

/** Marks the account's email as confirmed; `extra` columns are set in the same update. */
export async function markEmailVerified(userId: string, extra: Record<string, unknown> = {}): Promise<void> {
  const res = await fetch(sbUrl(`users?id=eq.${encodeURIComponent(userId)}`), {
    method: 'PATCH',
    headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify({ email_verified_at: new Date().toISOString(), ...extra }),
  });
  if (!res.ok) throw new Error(`Marking email verified failed: ${res.status} ${await res.text()}`);
}

/**
 * A one-time /verify-email link for the account (valid 24 hours). Earlier unused links stop working.
 * `next` is where to go after confirming (same-site paths only).
 */
export async function createVerifyEmailLink(userId: string, baseUrl: string, next?: string | null): Promise<string> {
  await fetch(sbUrl(`email_verifications?user_id=eq.${encodeURIComponent(userId)}&used_at=is.null`), { method: 'DELETE', headers: sbHeaders() });
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const res = await fetch(sbUrl('email_verifications'), {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify({ token_hash: tokenHash, user_id: userId, expires_at: new Date(Date.now() + VERIFY_TTL_MS).toISOString() }),
  });
  if (!res.ok) throw new Error(`Saving verification token failed: ${res.status} ${await res.text()}`);
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? `&next=${encodeURIComponent(next)}` : '';
  return `${baseUrl.replace(/\/+$/, '')}/verify-email?token=${token}${safeNext}`;
}

/** Uses a verification token once. Returns the account's id, or null when it's unknown, used or expired. */
export async function claimVerifyEmailToken(token: string): Promise<string | null> {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const now = new Date().toISOString();
  const res = await fetch(
    sbUrl(`email_verifications?token_hash=eq.${tokenHash}&used_at=is.null&expires_at=gt.${encodeURIComponent(now)}`),
    {
      method: 'PATCH',
      headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
      body: JSON.stringify({ used_at: now }),
    }
  );
  if (!res.ok) throw new Error(`Verification token lookup failed: ${res.status} ${await res.text()}`);
  const [row] = await res.json();
  return row?.user_id ?? null;
}
