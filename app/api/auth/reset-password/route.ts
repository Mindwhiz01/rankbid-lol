import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { INVITE_PLACEHOLDER, endSessions, getAccount, passwordProblem, setPassword } from '@/lib/server/account';
import { logAdminActivity } from '@/lib/server/admin-activity';
import { ipHash, rateLimit } from '@/lib/server/rate-limit';
import { sbHeaders, sbUrl, supabaseConfigured } from '@/lib/server/votes';

// POST { token, password }: sets a new password from an emailed reset link, then signs the
// account out everywhere (whoever knew the old password is logged out too).
export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json().catch(() => ({}));
    if (typeof token !== 'string' || !token || token.length > 200) {
      return NextResponse.json({ error: 'This reset link is invalid. Please request a new one.' }, { status: 400 });
    }
    const problem = passwordProblem(password);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    if (!supabaseConfigured()) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    if (!(await rateLimit(`reset-use-ip:${ipHash(req)}`, 20, 60 * 60))) {
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    }

    // Claim the token: unused and unexpired, marked used in the same request so it works once.
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const now = new Date().toISOString();
    const claim = await fetch(
      sbUrl(`password_resets?token_hash=eq.${tokenHash}&used_at=is.null&expires_at=gt.${encodeURIComponent(now)}`),
      {
        method: 'PATCH',
        headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
        body: JSON.stringify({ used_at: now }),
      }
    );
    if (!claim.ok) throw new Error(`Reset token lookup failed: ${claim.status} ${await claim.text()}`);
    const [row] = await claim.json();
    if (!row) {
      return NextResponse.json({ error: 'This reset link has expired or was already used. Please request a new one.' }, { status: 400 });
    }

    const account = await getAccount({ id: row.user_id });
    await setPassword(row.user_id, password);
    await endSessions(row.user_id);
    // An invited admin choosing their first password: their invite is now accepted.
    if (account?.password === INVITE_PLACEHOLDER) {
      await logAdminActivity(req, 'team.invite_accepted', account.email, undefined, account.email);
    }
    const res = NextResponse.json({ success: true });
    res.cookies.delete('auth_token');
    return res;
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Could not reset the password. Please try again.' }, { status: 500 });
  }
}
