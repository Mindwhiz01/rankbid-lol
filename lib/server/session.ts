// Server-only: who is signed in, read from the httpOnly auth_token cookie.
// Never trust a user id sent by the browser (body, query or header); use this instead.
import { randomBytes } from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';
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

const SESSION_DAYS = 30;

/** Signs `userId` in: saves a new session and returns its token, for setSessionCookie. */
export async function createSession(userId: string): Promise<string> {
  const token = createSessionToken();
  const res = await fetch(sbUrl('sessions'), {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify({ token, user_id: userId, expires_at: new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString() }),
  });
  if (!res.ok) throw new Error(`Session create failed: ${res.status} ${await res.text()}`);
  return token;
}

/** The httpOnly cookie that carries a session token (scripts in the page can't read it). */
export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DAYS * 86_400,
    path: '/',
  });
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
    // One request: the session with its account embedded (sessions.user_id → users.id).
    const sessionRes = await fetch(
      sbUrl(`sessions?token=eq.${encodeURIComponent(token)}&select=expires_at,user:users(id,email,name,blocked_at)`),
      { headers: sbHeaders(), cache: 'no-store' }
    );
    if (!sessionRes.ok) return null;
    const [session] = await sessionRes.json();
    if (!session || new Date(session.expires_at) < new Date()) return null;
    const user = session.user;
    if (!user || user.blocked_at) return null;
    return { id: String(user.id), email: String(user.email).toLowerCase(), name: user.name ?? null };
  } catch {
    return null;
  }
}
