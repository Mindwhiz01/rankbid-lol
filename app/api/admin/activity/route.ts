import { NextRequest, NextResponse } from 'next/server';
import { isOwnerRequest, sbSelect } from '@/lib/server/admin';
import { ACTIVITY_ACTIONS } from '@/lib/server/admin-activity';

const cleanSearch = (s: string) => s.replace(/[,()*\\]/g, ' ').trim();

// GET ?page&limit&actor&action&search — the admin activity log, newest first. Owner only:
// it's how the owner sees what each team admin changed or deleted.
export async function GET(req: NextRequest) {
  if (!(await isOwnerRequest(req))) {
    return NextResponse.json({ error: 'Only the owner can view the activity log' }, { status: 403 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25') || 25));
    const actor = searchParams.get('actor');
    const action = searchParams.get('action');
    const search = cleanSearch(searchParams.get('search') || '');

    let path = `admin_activity?select=*&order=created_at.desc&limit=${limit}&offset=${(page - 1) * limit}`;
    if (actor) path += `&actor=eq.${encodeURIComponent(actor)}`;
    if (action) path += `&action=eq.${encodeURIComponent(action)}`;
    if (search) path += `&target=ilike.${encodeURIComponent(`*${search}*`)}`;

    const [{ rows, total }, actors] = await Promise.all([
      sbSelect<Record<string, unknown>>(path),
      sbSelect<{ actor: string }>('admin_activity?select=actor&order=actor.asc&limit=1000'),
    ]);

    return NextResponse.json({
      entries: rows,
      actors: [...new Set(actors.rows.map((r) => r.actor))],
      labels: ACTIVITY_ACTIONS,
      pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    console.error('Error fetching admin activity:', error);
    return NextResponse.json({ error: 'Failed to load the activity log. Has admin_activity.sql been run?' }, { status: 500 });
  }
}
