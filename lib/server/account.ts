// Server-only: account records for password changes, resets and account deletion (Supabase REST).
import bcryptjs from 'bcryptjs';
import { sbHeaders, sbUrl } from '@/lib/server/votes';

/** Accounts created with Google sign-in store this instead of a password hash. */
export const GOOGLE_PLACEHOLDER = 'google_oauth';

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
  if (typeof password !== 'string' || !password || account.password === GOOGLE_PLACEHOLDER) return false;
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
