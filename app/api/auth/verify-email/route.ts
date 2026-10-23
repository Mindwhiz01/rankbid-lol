import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, isCrossSiteWrite } from '@/lib/server/session';
import { BLOCKED_MESSAGE, claimVerifyEmailToken, getAccount, isBlocked, markEmailVerified } from '@/lib/server/account';
import { ipHash, rateLimit } from '@/lib/server/rate-limit';

// POST { token }: confirms the email from the signup link and signs the account in.
export async function POST(req: NextRequest) {
  if (isCrossSiteWrite(req)) {
    return NextResponse.json({ error: 'Cross-site request refused' }, { status: 403 });
  }
  try {
    const { token } = await req.json().catch(() => ({}));
    if (typeof token !== 'string' || !token || token.length > 200) {
      return NextResponse.json({ error: 'This confirmation link is invalid.' }, { status: 400 });
    }
    if (!(await rateLimit(`verify-ip:${ipHash(req)}`, 20, 60 * 60))) {
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    }

    const userId = await claimVerifyEmailToken(token);
    if (!userId) {
      return NextResponse.json({ error: 'This confirmation link has expired or was already used. Sign in to get a new one.' }, { status: 400 });
    }
    await markEmailVerified(userId);

    const account = await getAccount({ id: userId });
    if (!account) return NextResponse.json({ error: 'This account no longer exists.' }, { status: 404 });
    if (await isBlocked(userId)) return NextResponse.json({ error: BLOCKED_MESSAGE }, { status: 403 });

    const session = createSessionToken();
    await prisma.session.create({
      data: { token: session, userId, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });
    const res = NextResponse.json({ success: true, user: { id: account.id, email: account.email, name: account.name } });
    res.cookies.set('auth_token', session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });
    return res;
  } catch (error) {
    console.error('Verify email error:', error);
    return NextResponse.json({ error: 'Could not confirm the email. Please try again.' }, { status: 500 });
  }
}
