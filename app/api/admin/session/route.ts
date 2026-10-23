import { NextRequest, NextResponse } from 'next/server';
import { isCrossSiteWrite } from '@/lib/server/session';
import { ADMIN_COOKIE, adminCookieValue, isAdminRequest, isValidAdminKey } from '@/lib/server/admin';
import { ipHash, rateLimit } from '@/lib/server/rate-limit';
import { sbHeaders, sbUrl } from '@/lib/server/votes';
import { ADMIN_KEY_ACTOR, logAdminActivity } from '@/lib/server/admin-activity';

// GET: is this browser an admin (admin key cookie, or signed in with an admin email)?
export async function GET(req: NextRequest) {
  return NextResponse.json({ admin: await isAdminRequest(req) });
}

// POST { key }: exchange the admin key for an httpOnly cookie.
export async function POST(req: NextRequest) {
  if (isCrossSiteWrite(req)) {
    return NextResponse.json({ error: 'Cross-site request refused' }, { status: 403 });
  }
  if (!(await rateLimit(`admin-login:${ipHash(req)}`, 10, 15 * 60))) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }
  const { key } = await req.json().catch(() => ({ key: null }));
  if (!isValidAdminKey(key)) {
    return NextResponse.json({ error: 'Invalid admin key' }, { status: 401 });
  }
  await logAdminActivity(req, 'session.key_sign_in', null, undefined, ADMIN_KEY_ACTOR);
  const res = NextResponse.json({ admin: true });
  res.cookies.set(ADMIN_COOKIE, adminCookieValue()!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  });
  return res;
}

// DELETE: sign out of the dashboard: drops the admin key cookie and ends an email sign-in too,
// since admins who signed in with their account would otherwise still be admins.
export async function DELETE(req: NextRequest) {
  if (await isAdminRequest(req)) await logAdminActivity(req, 'session.sign_out', null);
  const token = req.cookies.get('auth_token')?.value;
  if (token) {
    await fetch(sbUrl(`sessions?token=eq.${encodeURIComponent(token)}`), { method: 'DELETE', headers: sbHeaders() }).catch(() => null);
  }
  const res = NextResponse.json({ admin: false });
  res.cookies.delete(ADMIN_COOKIE);
  res.cookies.delete('auth_token');
  return res;
}
