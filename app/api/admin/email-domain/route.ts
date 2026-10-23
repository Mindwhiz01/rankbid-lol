import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { isAdminRequest } from '@/lib/server/admin';
import { logAdminActivity } from '@/lib/server/admin-activity';

// The rankbid.click sending domain in Resend; its DNS records must exist at the DNS host.
const DOMAIN_ID = process.env.RESEND_DOMAIN_ID || 'a58a1b46-1f82-44c1-97f1-2e09dea78561';

function client() {
  return process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
}

// GET: the domain's status and the DNS records Resend expects.
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const resend = client();
  if (!resend) return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });

  const { data, error } = await resend.domains.get(DOMAIN_ID);
  if (error || !data) return NextResponse.json({ error: error?.message || 'Domain not found' }, { status: 502 });
  return NextResponse.json({ name: data.name, status: data.status, region: data.region, records: data.records });
}

// POST: ask Resend to re-check the DNS records now.
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const resend = client();
  if (!resend) return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });

  const { error } = await resend.domains.verify(DOMAIN_ID);
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  await logAdminActivity(req, 'email.verify_domain', DOMAIN_ID);
  const { data } = await resend.domains.get(DOMAIN_ID);
  return NextResponse.json({ verifying: true, status: data?.status, records: data?.records });
}
