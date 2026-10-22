import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import type { NextRequest } from 'next/server';
import { sendWaitlistWelcomeEmail } from '@/lib/email';
import { ipHash, rateLimit } from '@/lib/server/rate-limit';
import { SITE_URL } from '@/lib/site';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);
// Only create the client when a key is set; constructing it without one throws and breaks builds.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(request: NextRequest) {
  try {
    if (!(await rateLimit(`waitlist-ip:${ipHash(request)}`, 5, 60 * 60))) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const { data: existing, error: checkError } = await supabase
      .from('waitlist')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Check error:', checkError);
      return NextResponse.json(
        { error: 'Could not join the waitlist. Please try again.' },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json(
        { error: 'This email is already on the waitlist' },
        { status: 409 }
      );
    }

    // Add to waitlist
    const { data, error } = await supabase
      .from('waitlist')
      .insert({
        email: email,
        createdAt: new Date().toISOString(),
      })
      .select();

    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json(
        { error: 'Could not join the waitlist. Please try again.' },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      console.error('Insert succeeded but no data returned');
      return NextResponse.json(
        { error: 'Email was not saved. Please try again.' },
        { status: 500 }
      );
    }

    // Confirm to the person who joined. Never throws, so a failed email doesn't fail the signup.
    await sendWaitlistWelcomeEmail({ to: email });

    // Send email notification to admin
    if (resend && process.env.ADMIN_EMAIL) {
      try {
        await resend.emails.send({
          from: 'RankBid <noreply@rankbid.click>',
          to: process.env.ADMIN_EMAIL,
          subject: '🎉 New Waitlist Signup',
          html: `
            <h2>New waitlist member!</h2>
            <p><strong>Email:</strong> ${escapeHtml(email)}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            <p><a href="${SITE_URL}/admin">View waitlist →</a></p>
          `,
        });
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
        // Don't fail the request if email sending fails
      }
    }

    return NextResponse.json(
      { success: true },
      { status: 201 }
    );
  } catch (error) {
    console.error('Waitlist error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
