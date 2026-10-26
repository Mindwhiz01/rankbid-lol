import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest, isOwnerRequest } from '@/lib/server/admin';
import { isComingSoonEnabled, setComingSoonEnabled } from '@/lib/server/site-settings';
import { logAdminActivity } from '@/lib/server/admin-activity';
import { isLiveHost, SITE_HOST } from '@/lib/site';

// The sandbox shares the live database, so the switch is only changed from the live domain's admin,
// and only by the owner. Opening the site needs the word LAUNCH typed in the confirmation.
const LAUNCH_WORD = 'LAUNCH';

/** Why this request may not change the switch, or null when it may. */
async function cannotChange(req: NextRequest): Promise<string | null> {
  if (!isLiveHost(req.headers.get('host'))) return `Change this from the admin on ${SITE_HOST}. The sandbox can’t switch the live site.`;
  if (!(await isOwnerRequest(req))) return 'Only the owner can change this.';
  return null;
}

// GET: current site switches, and whether this admin may change them here.
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const locked = await cannotChange(req);
  return NextResponse.json({ comingSoon: await isComingSoonEnabled(), site: SITE_HOST, canChange: !locked, lockedReason: locked });
}

// PATCH { comingSoon: boolean, confirm?: 'LAUNCH' }: turn the coming soon page on or off for everyone.
export async function PATCH(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const locked = await cannotChange(req);
  if (locked) return NextResponse.json({ error: locked }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (typeof body?.comingSoon !== 'boolean') {
    return NextResponse.json({ error: 'comingSoon must be true or false' }, { status: 400 });
  }
  if (!body.comingSoon && body.confirm !== LAUNCH_WORD) {
    return NextResponse.json({ error: `Type ${LAUNCH_WORD} to open the site` }, { status: 400 });
  }
  try {
    const before = await isComingSoonEnabled();
    await setComingSoonEnabled(body.comingSoon);
    await logAdminActivity(req, 'settings.coming_soon', body.comingSoon ? 'Coming soon page ON' : 'Coming soon page OFF', { before, after: body.comingSoon });
    return NextResponse.json({ comingSoon: body.comingSoon });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Could not save the setting. Has add_site_settings.sql been run?' }, { status: 500 });
  }
}
