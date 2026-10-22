// Server-only: who is signed in, read from the httpOnly auth_token cookie.
// Never trust a user id sent by the browser (body, query or header); use this instead.
import { randomBytes } from 'crypto';
import type { NextRequest } from 'next/server';
import { sbHeaders, sbUrl, supabaseConfigured } from '@/lib/server/votes';

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

/** 256-bit random session token. */
export function createSessionToken(): string {
  return 'session_' + randomBytes(32).toString('base64url');
}

/**
 * CSRF guard: true for a state-changing request another site made the browser send. Browsers label
 * requests with Sec-Fetch-Site (and Origin); scripts and webhooks send neither and are judged by their own auth.
 */
export function isCrossSiteWrite(req: NextRequest): boolean {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return false;
  const site = req.headers.get('sec-fetch-site');
  if (site) return site === 'cross-site';
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.headers.get('host');
  } catch {
    return true;
  }
}

export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  // A write another site triggered doesn't get the visitor's session, even if the browser sent the cookie.
  if (isCrossSiteWrite(req)) return null;
  const token = req.cookies.get('auth_token')?.value;
  if (!token || !supabaseConfigured()) return null;
  try {
    const sessionRes = await fetch(
      sbUrl(`sessions?token=eq.${encodeURIComponent(token)}&select=user_id,expires_at`),
      { headers: sbHeaders(), cache: 'no-store' }
    );
    if (!sessionRes.ok) return null;
    const [session] = await sessionRes.json();
    if (!session || new Date(session.expires_at) < new Date()) return null;

    const userRes = await fetch(
      sbUrl(`users?id=eq.${encodeURIComponent(session.user_id)}&select=id,email,name`),
      { headers: sbHeaders(), cache: 'no-store' }
    );
    if (!userRes.ok) return null;
    const [user] = await userRes.json();
    if (!user) return null;
    return { id: String(user.id), email: String(user.email).toLowerCase(), name: user.name ?? null };
  } catch {
    return null;
  }
}
