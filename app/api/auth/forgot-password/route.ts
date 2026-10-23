import { NextRequest, NextResponse } from 'next/server';
import { createPasswordLink, getAccount } from '@/lib/server/account';
import { ipHash, rateLimit } from '@/lib/server/rate-limit';
import { supabaseConfigured } from '@/lib/server/votes';
import { sendPasswordResetEmail } from '@/lib/email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESET_TTL_MS = 60 * 60 * 1000;

// POST { email }: emails a one-time reset link if an account exists. The answer is the same
// either way, so this can't be used to find out who has an account.
export async function POST(req: NextRequest) {
  const done = NextResponse.json({ success: true, message: 'If an account exists for that email, we sent a link to reset the password.' });
  try {
    const { email } = await req.json().catch(() => ({}));
    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim()) || email.length > 254) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }
    if (!supabaseConfigured()) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });

    const key = email.trim().toLowerCase();
    if (!(await rateLimit(`reset-ip:${ipHash(req)}`, 10, 60 * 60)) || !(await rateLimit(`reset-email:${key}`, 3, 60 * 60))) {
      return NextResponse.json({ error: 'Too many reset requests. Please wait an hour and try again.' }, { status: 429 });
    }

    const account = await getAccount({ email: key });
    if (!account) return done;

    const resetUrl = await createPasswordLink(account.id, RESET_TTL_MS, process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin);
    const sent = await sendPasswordResetEmail({ to: account.email, name: account.name, resetUrl });
    if (!sent.sent) console.error('Password reset email not sent:', sent.error);
    return done;
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Could not send the reset email. Please try again.' }, { status: 500 });
  }
}
