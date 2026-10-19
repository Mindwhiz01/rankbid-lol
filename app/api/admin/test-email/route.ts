import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/server/admin';
import { sendNewSubmissionEmail } from '@/lib/email';
import { SITE_URL } from '@/lib/site';

// POST: send a sample "new submission" email to NOTIFICATION_EMAIL, to check delivery.
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await sendNewSubmissionEmail({
    id: 'test',
    title: 'Test notification',
    description: 'This is a test of the new submission email. Real submissions look like this.',
    category: 'Other',
    platform: 'website',
    url: SITE_URL,
  });
  return NextResponse.json(result, { status: result.sent ? 200 : 502 });
}
