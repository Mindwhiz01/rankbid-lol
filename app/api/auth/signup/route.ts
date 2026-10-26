import bcryptjs from 'bcryptjs';
import { isCrossSiteWrite } from '@/lib/server/session';
import { GOOGLE_PLACEHOLDER, INVITE_PLACEHOLDER, createAccount, createVerifyEmailLink, getAccount, isEmailVerified, updateAccount } from '@/lib/server/account';
import { sendVerifyEmail } from '@/lib/email';
import { clientIp, ipHash, rateLimit } from '@/lib/server/rate-limit';
import { verifyTurnstile } from '@/lib/server/turnstile';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  if (isCrossSiteWrite(request)) {
    return NextResponse.json({ error: 'Cross-site request refused' }, { status: 403 });
  }
  try {
    const { email, password, name, turnstileToken, next } = await request.json();

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    if (password.length < 8 || password.length > 200) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    if (name !== undefined && (typeof name !== 'string' || name.length > 80)) {
      return NextResponse.json({ error: 'Name must be 80 characters or fewer' }, { status: 400 });
    }

    // Bot check (Cloudflare Turnstile); passes automatically while TURNSTILE_SECRET_KEY is unset.
    if (!(await verifyTurnstile(turnstileToken, clientIp(request)))) {
      return NextResponse.json({ error: 'The "I am human" check failed. Please try again.' }, { status: 400 });
    }

    const ip = ipHash(request);
    if ((await Promise.all([rateLimit(`signup-ip:${ip}`, 5, 60 * 60), rateLimit(`signup-ip-day:${ip}`, 15, 24 * 60 * 60)])).includes(false)) {
      return NextResponse.json(
        { error: 'Too many accounts created from this network. Please try again later.' },
        { status: 429 }
      );
    }

    const key = email.toLowerCase();
    const [existingUser, hashedPassword] = await Promise.all([getAccount({ email: key }), bcryptjs.hash(password, 10)]);

    // An account that never confirmed its email proves nothing about who made it, so signing up
    // again replaces its password; only whoever can open the confirmation email gets in.
    let userId: string;
    if (existingUser) {
      const pending = existingUser.password !== GOOGLE_PLACEHOLDER && existingUser.password !== INVITE_PLACEHOLDER
        && !(await isEmailVerified(existingUser.id));
      if (!pending) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
      }
      await updateAccount(existingUser.id, { password: hashedPassword, name: name || existingUser.name });
      userId = existingUser.id;
    } else {
      const user = await createAccount({ email: key, password: hashedPassword, name });
      userId = user.id;
    }

    // No session yet: the account works once the emailed link is opened.
    const verifyUrl = await createVerifyEmailLink(userId, process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin, typeof next === 'string' ? next : null);
    const sent = await sendVerifyEmail({ to: key, name: name || existingUser?.name, verifyUrl });
    if (!sent.sent) {
      console.error('Verification email not sent:', sent.error);
      return NextResponse.json({ error: 'We couldn’t send the confirmation email. Please try again.' }, { status: 502 });
    }
    return NextResponse.json({ success: true, verifyEmail: true, email: key }, { status: 201 });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Signup failed' },
      { status: 500 }
    );
  }
}
