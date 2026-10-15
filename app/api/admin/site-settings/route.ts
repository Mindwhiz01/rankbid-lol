import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/server/admin';
import { isComingSoonEnabled, setComingSoonEnabled } from '@/lib/server/site-settings';

// GET: current site switches.
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ comingSoon: await isComingSoonEnabled() });
}

// PATCH { comingSoon: boolean }: turn the coming soon page on or off for everyone.
export async function PATCH(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (typeof body?.comingSoon !== 'boolean') {
    return NextResponse.json({ error: 'comingSoon must be true or false' }, { status: 400 });
  }
  try {
    await setComingSoonEnabled(body.comingSoon);
    return NextResponse.json({ comingSoon: body.comingSoon });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Could not save the setting. Has add_site_settings.sql been run?' }, { status: 500 });
  }
}
