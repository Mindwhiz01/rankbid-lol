import { OAuth2Client } from 'google-auth-library';
import { createSession, isCrossSiteWrite, setSessionCookie } from '@/lib/server/session';
import { ipHash, rateLimit } from '@/lib/server/rate-limit';
import { logAdminSignIn } from '@/lib/server/admin-activity';
import { BLOCKED_MESSAGE, GOOGLE_PLACEHOLDER, createAccount, getAccount, isBlocked, isEmailVerified, markEmailVerified } from '@/lib/server/account';
import { NextRequest, NextResponse } from 'next/server';

const client = new OAuth2Client(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

export async function POST(request: NextRequest) {
  if (isCrossSiteWrite(request)) {
    return NextResponse.json({ error: 'Cross-site request refused' }, { status: 403 });
  }
  try {
    if (!(await rateLimit(`google-ip:${ipHash(request)}`, 30, 15 * 60))) {
      return NextResponse.json({ error: 'Too many sign-in attempts. Please wait and try again.' }, { status: 429 });
    }
    const { token } = await request.json().catch(() => ({}));

    if (typeof token !== 'string' || !token || token.length > 4096) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
      return NextResponse.json(
        { error: 'Google OAuth not configured' },
        { status: 500 }
      );
    }

    // Verify the Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    // Only trust addresses Google has verified; otherwise anyone could claim an existing account's email.
    if (!payload || !payload.email || payload.email_verified !== true) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Find or create the account (Google-only accounts store a placeholder instead of a password hash).
    const user = (await getAccount({ email: payload.email }))
      ?? (await createAccount({ email: payload.email, name: payload.name, password: GOOGLE_PLACEHOLDER }));

    // Google has verified this address. An unconfirmed email signup for it may have been made by
    // someone else, so its password is dropped: from now on it signs in with Google (or a reset).
    if (!(await isEmailVerified(user.id))) {
      await markEmailVerified(user.id, { password: GOOGLE_PLACEHOLDER });
    }

    if (await isBlocked(user.id)) {
      return NextResponse.json({ error: BLOCKED_MESSAGE }, { status: 403 });
    }

    const sessionToken = await createSession(user.id);
    await logAdminSignIn(request, user.email, 'google');

    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      },
      { status: 200 }
    );

    setSessionCookie(response, sessionToken);
    return response;
  } catch (error) {
    console.error('Google OAuth error:', error);
    return NextResponse.json(
      { error: 'Google authentication failed' },
      { status: 500 }
    );
  }
}
