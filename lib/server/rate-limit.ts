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

/** Salted hash of the client IP, so we can limit abuse without storing raw addresses. */
export function ipHash(req: NextRequest): string {
  const salt = process.env.IP_HASH_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createHash('sha256').update(`${salt}:${clientIp(req)}`).digest('hex').slice(0, 32);
}

/**
 * Counts one hit for `key` and returns false once `limit` hits happened within `windowSec`.
 * Fails open (allows) if the table can't be reached, so an outage doesn't block the site.
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  if (!supabaseConfigured()) return true;
  try {
    // Record the hit first, then count it with the rest. Counting first let a burst of parallel
    // requests all see the same count and all get through.
    const since = new Date(Date.now() - windowSec * 1000).toISOString();
    await fetch(sbUrl('rate_limits'), {
      method: 'POST',
      headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify({ key }),
      cache: 'no-store',
    });
    const countRes = await fetch(
      sbUrl(`rate_limits?key=eq.${encodeURIComponent(key)}&created_at=gte.${encodeURIComponent(since)}&select=id`),
      { method: 'HEAD', headers: sbHeaders({ Prefer: 'count=exact' }), cache: 'no-store' }
    );
    if (!countRes.ok) {
      console.error('rate_limits count failed:', countRes.status);
      return true;
    }
    const count = parseInt(countRes.headers.get('content-range')?.split('/')[1] || '0') || 0;
    return count <= limit;
  } catch (error) {
    console.error('rateLimit error:', error);
    return true;
  }
}

/** Deletes rate-limit rows older than a day (called by the daily cron). */
export async function pruneRateLimits(): Promise<void> {
  if (!supabaseConfigured()) return;
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await fetch(sbUrl(`rate_limits?created_at=lt.${encodeURIComponent(cutoff)}`), {
    method: 'DELETE',
    headers: sbHeaders(),
  }).catch(() => {});
}
