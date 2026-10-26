import { createSession, isCrossSiteWrite, setSessionCookie } from '@/lib/server/session';
import { BLOCKED_MESSAGE, getAccount, isBlocked, isEmailVerified, passwordMatches } from '@/lib/server/account';
import { ipHash, rateLimit } from '@/lib/server/rate-limit';
import { logAdminSignIn } from '@/lib/server/admin-activity';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  if (isCrossSiteWrite(request)) {
    return NextResponse.json({ error: 'Cross-site request refused' }, { status: 403 });
  }
  try {
    const { email, password } = await request.json();

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const ip = ipHash(request);
    const emailKey = email.toLowerCase().slice(0, 254);
    const [ipOk, emailOk] = await Promise.all([
      rateLimit(`login-ip:${ip}`, 20, 15 * 60),
      rateLimit(`login-email:${emailKey}`, 10, 15 * 60),
    ]);
    if (!ipOk || !emailOk) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please wait 15 minutes and try again.' },
        { status: 429 }
      );
    }

    const user = await getAccount({ email });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const passwordMatch = await passwordMatches(user, password);

    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const [blocked, verified] = await Promise.all([isBlocked(user.id), isEmailVerified(user.id)]);
    if (blocked) {
      return NextResponse.json({ error: BLOCKED_MESSAGE }, { status: 403 });
    }

    if (!verified) {
      return NextResponse.json(
        { error: 'Please confirm your email first. Check your inbox for the link we sent.', unverified: true },
        { status: 403 }
      );
    }

    const token = await createSession(user.id);
    await logAdminSignIn(request, user.email, 'password');

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
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
