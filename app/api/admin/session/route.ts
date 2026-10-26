import { NextRequest, NextResponse } from 'next/server';
import { isCrossSiteWrite } from '@/lib/server/session';
import { adminAccount } from '@/lib/server/admin';
import { clearSecondFactor, codeMatches, grantSecondFactor, hasAdminSecondFactor, sessionHandle, startChallenge } from '@/lib/server/admin-2fa';
import { ipHash, rateLimit } from '@/lib/server/rate-limit';
import { sbHeaders, sbUrl } from '@/lib/server/votes';
import { logAdminActivity } from '@/lib/server/admin-activity';
import { sendAdminSignInCode } from '@/lib/email';

// Admins sign in with their own account (email + password via /api/auth/login), then enter a code
// emailed to them. There is no shared admin password.

// GET: is this browser an admin? needsCode: signed in with an admin account but the code step is pending.
export async function GET(req: NextRequest) {
  const account = await adminAccount(req);
  const admin = Boolean(account && hasAdminSecondFactor(req));
  return NextResponse.json({ admin, needsCode: Boolean(account && !admin), email: account && !admin ? account.email : undefined });
}

// POST {}: email a new sign-in code. POST { code }: check it and finish signing in.
export async function POST(req: NextRequest) {
  if (isCrossSiteWrite(req)) {
    return NextResponse.json({ error: 'Cross-site request refused' }, { status: 403 });
  }
  const token = req.cookies.get('auth_token')?.value;
  const account = token ? await adminAccount(req) : null;
  if (!token || !account) {
    return NextResponse.json({ error: 'Sign in with your admin account first' }, { status: 401 });
  }
  const { code } = await req.json().catch(() => ({ code: undefined }));

  if (code === undefined) {
    if (!(await rateLimit(`admin-code-send:${account.id}`, 5, 15 * 60))) {
      return NextResponse.json({ error: 'Too many codes sent. Wait 15 minutes and try again.' }, { status: 429 });
    }
    const res = NextResponse.json({ sent: true, email: account.email });
    const result = await sendAdminSignInCode({ to: account.email, code: startChallenge(res, token) });
    if (!result.sent) {
      console.error('Admin sign-in code email failed:', result.error);
      return NextResponse.json({ error: 'Could not send the code. Try again in a minute.' }, { status: 502 });
    }
    return res;
  }

  // Five tries per sign-in (and twenty per network) before a 15-minute wait.
  if (
    !(await rateLimit(`admin-code:${sessionHandle(token)}`, 5, 15 * 60)) ||
    !(await rateLimit(`admin-code-ip:${ipHash(req)}`, 20, 15 * 60))
  ) {
    return NextResponse.json({ error: 'Too many wrong codes. Wait 15 minutes, then request a new one.' }, { status: 429 });
  }
  if (!codeMatches(req, token, String(code).trim())) {
    return NextResponse.json({ error: 'That code is wrong or has expired' }, { status: 401 });
  }
  await logAdminActivity(req, 'session.code_verified', account.email, undefined, account.email);
  const res = NextResponse.json({ admin: true });
  grantSecondFactor(res, token);
  return res;
}

// DELETE: sign out of the dashboard, ending the account session too.
export async function DELETE(req: NextRequest) {
  if (hasAdminSecondFactor(req) && (await adminAccount(req))) await logAdminActivity(req, 'session.sign_out', null);
  const token = req.cookies.get('auth_token')?.value;
  if (token) {
    await fetch(sbUrl(`sessions?token=eq.${encodeURIComponent(token)}`), { method: 'DELETE', headers: sbHeaders() }).catch(() => null);
  }
  const res = NextResponse.json({ admin: false });
  clearSecondFactor(res);
  res.cookies.delete('adminKey'); // the removed admin-key sign-in's cookie, if a browser still has it
  res.cookies.delete('auth_token');
  return res;
}
