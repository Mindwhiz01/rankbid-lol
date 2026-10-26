import { NextRequest, NextResponse } from 'next/server';
import { GOOGLE_PLACEHOLDER, INVITE_PLACEHOLDER, createVerifyEmailLink, getAccount, isEmailVerified } from '@/lib/server/account';
import { ipHash, rateLimit } from '@/lib/server/rate-limit';
import { isCrossSiteWrite } from '@/lib/server/session';
import { sendVerifyEmail } from '@/lib/email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// POST { email, next? }: sends a fresh confirmation link to an unconfirmed account. The answer is the
// same either way, so this can't be used to find out who has an account.
export async function POST(req: NextRequest) {
  if (isCrossSiteWrite(req)) {
    return NextResponse.json({ error: 'Cross-site request refused' }, { status: 403 });
  }
  const done = NextResponse.json({ success: true, message: 'If that account still needs confirming, we sent a new link.' });
  try {
    const { email, next } = await req.json().catch(() => ({}));
    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim()) || email.length > 254) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }
    const key = email.trim().toLowerCase();
    if ((await Promise.all([rateLimit(`verify-resend-ip:${ipHash(req)}`, 10, 60 * 60), rateLimit(`verify-resend:${key}`, 3, 60 * 60)])).includes(false)) {
      return NextResponse.json({ error: 'Too many emails sent. Please wait an hour and try again.' }, { status: 429 });
    }

    const account = await getAccount({ email: key });
    if (!account || account.password === GOOGLE_PLACEHOLDER || account.password === INVITE_PLACEHOLDER || (await isEmailVerified(account.id))) {
      return done;
    }
    const verifyUrl = await createVerifyEmailLink(account.id, process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin, typeof next === 'string' ? next : null);
    const sent = await sendVerifyEmail({ to: account.email, name: account.name, verifyUrl });
    if (!sent.sent) console.error('Verification email not sent:', sent.error);
    return done;
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json({ error: 'Could not send the email. Please try again.' }, { status: 500 });
  }
}
