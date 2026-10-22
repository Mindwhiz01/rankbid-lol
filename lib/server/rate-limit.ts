// Server-only rate limiting, stored in the rate_limits table so it holds across serverless instances
// (see supabase/migrations/security_hardening.sql).
import { createHash } from 'crypto';
import type { NextRequest } from 'next/server';
import { sbHeaders, sbUrl, supabaseConfigured } from '@/lib/server/votes';

/** Client IP as reported by Vercel's edge (it overwrites any value the client sends). */
export function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown'
  );
}

/**
 * Networks that skip the per-network limits (e.g. the team's office while testing): RATE_LIMIT_EXEMPT_IPS,
 * comma-separated full IPs, or prefixes ending in "." ("203.101." covers 203.101.*.*). Per-account and
 * per-email limits still apply, so passwords can't be brute-forced from there either.
 */
function isExemptIp(ip: string): boolean {
  return (process.env.RATE_LIMIT_EXEMPT_IPS || '').split(',').map(s => s.trim()).filter(Boolean)
    .some(entry => (entry.endsWith('.') || entry.endsWith(':') ? ip.startsWith(entry) : ip === entry));
}
const EXEMPT = 'exempt';

/** Per-account activity limits that RATE_LIMIT_EXEMPT_USERS skips. Login, reset, password and delete limits stay. */
const ACCOUNT_ACTIVITY = new Set(['vote-user', 'submit-saved', 'submit-saved-day', 'link-edit']);
let exemptUsers: { ids: Set<string>; at: number } | null = null;

/**
 * Account ids for RATE_LIMIT_EXEMPT_USERS (comma-separated emails, e.g. testers), looked up once a minute.
 * A lookup that fails leaves the limits on.
 */
async function exemptUserIds(): Promise<Set<string>> {
  const emails = (process.env.RATE_LIMIT_EXEMPT_USERS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (!emails.length) return new Set();
  if (exemptUsers && Date.now() - exemptUsers.at < 60_000) return exemptUsers.ids;
  try {
    const list = emails.map(e => `"${e.replace(/"/g, '')}"`).join(',');
    const res = await fetch(sbUrl(`users?email=in.(${encodeURIComponent(list)})&select=id`), { headers: sbHeaders(), cache: 'no-store' });
    const rows: { id: string }[] = res.ok ? await res.json() : [];
    exemptUsers = { ids: new Set(rows.map(r => String(r.id))), at: Date.now() };
  } catch {
    exemptUsers = { ids: new Set(), at: Date.now() };
  }
  return exemptUsers.ids;
}

/** Salted hash of the client IP, so we can limit abuse without storing raw addresses. */
export function ipHash(req: NextRequest): string {
  const ip = clientIp(req);
  // Per-network keys built from this skip rateLimit below. Each exempt visitor still gets its own value.
  if (isExemptIp(ip)) return `${EXEMPT}-${createHash('sha256').update(`${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}:${ip}`).digest('hex').slice(0, 24)}`;
  const salt = process.env.IP_HASH_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

/**
 * Counts one hit for `key` and returns false once `limit` hits happened within `windowSec`.
 * Fails open (allows) if the table can't be reached, so an outage doesn't block the site.
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  // Exempt networks skip the abuse limits; click de-duplication still applies so test visits don't inflate counts.
  if (!supabaseConfigured() || (key.includes(`:${EXEMPT}-`) && !key.startsWith('click:'))) return true;
  const [kind, subject] = key.split(':');
  if (ACCOUNT_ACTIVITY.has(kind) && (await exemptUserIds()).has(subject)) return true;
  try {
    // Record the hit first, then count it with the rest. Counting first let a burst of parallel
    // requests all see the same count and all get through.
    const since = new Date(Date.now() - windowSec * 1000).toISOString();
    const insertRes = await fetch(sbUrl('rate_limits?select=id'), {
      method: 'POST',
      headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
      body: JSON.stringify({ key }),
      cache: 'no-store',
    });
    const hitId: unknown = insertRes.ok ? (await insertRes.json())[0]?.id : undefined;
    const countRes = await fetch(
      sbUrl(`rate_limits?key=eq.${encodeURIComponent(key)}&created_at=gte.${encodeURIComponent(since)}&select=id`),
      { method: 'HEAD', headers: sbHeaders({ Prefer: 'count=exact' }), cache: 'no-store' }
    );
    if (!countRes.ok) {
      console.error('rate_limits count failed:', countRes.status);
      return true;
    }
    const count = parseInt(countRes.headers.get('content-range')?.split('/')[1] || '0') || 0;
    if (count <= limit) return true;
    // A blocked request doesn't count, so retrying while limited doesn't push the window further out.
    if (hitId !== undefined) {
      await fetch(sbUrl(`rate_limits?id=eq.${encodeURIComponent(String(hitId))}`), {
        method: 'DELETE',
        headers: sbHeaders(),
        cache: 'no-store',
      });
    }
    return false;
  } catch (error) {
    console.error('rateLimit error:', error);
    return true;
  }
}

/** Daily cron cleanup: rate-limit rows older than a day, expired sessions and spent or expired reset links. */
export async function pruneRateLimits(): Promise<void> {
  if (!supabaseConfigured()) return;
  const now = encodeURIComponent(new Date().toISOString());
  const cutoff = encodeURIComponent(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  await Promise.all([
    `rate_limits?created_at=lt.${cutoff}`,
    `sessions?expires_at=lt.${now}`,
    `password_resets?or=(expires_at.lt.${now},used_at.not.is.null)`,
  ].map(path => fetch(sbUrl(path), { method: 'DELETE', headers: sbHeaders() }).catch(() => {})));
}
