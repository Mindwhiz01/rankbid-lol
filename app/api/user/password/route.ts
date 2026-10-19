import { NextRequest, NextResponse } from 'next/server';
import { endSessions, getAccount, GOOGLE_PLACEHOLDER, passwordMatches, passwordProblem, setPassword } from '@/lib/server/account';
import { rateLimit } from '@/lib/server/rate-limit';
import { getSessionUser } from '@/lib/server/session';

// POST { currentPassword, newPassword }: change the signed-in account's password.
// Google-only accounts have no password yet and can set one without currentPassword.
// Other devices are signed out; this browser stays signed in.
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { currentPassword, newPassword } = await req.json().catch(() => ({}));
    const problem = passwordProblem(newPassword);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    if (!(await rateLimit(`password-change:${user.id}`, 10, 60 * 60))) {
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    }

    const account = await getAccount({ id: user.id });
    if (!account) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const hasPassword = account.password !== GOOGLE_PLACEHOLDER;
    if (hasPassword && !(await passwordMatches(account, currentPassword))) {
      return NextResponse.json({ error: 'Your current password is incorrect' }, { status: 400 });
    }

    await setPassword(account.id, newPassword);
    await endSessions(account.id, req.cookies.get('auth_token')?.value);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Could not change the password. Please try again.' }, { status: 500 });
  }
}

// GET: whether the account has a password (Google-only accounts don't), for the settings form.
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const account = await getAccount({ id: user.id }).catch(() => null);
  return NextResponse.json({ hasPassword: Boolean(account && account.password !== GOOGLE_PLACEHOLDER) }, { headers: { 'Cache-Control': 'no-store' } });
}
