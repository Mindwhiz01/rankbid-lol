import { NextRequest, NextResponse } from 'next/server';
import { sbHeaders, sbUrl } from '@/lib/server/votes';
import { ANONYMOUS_USER_ID, isAdminRequest, removeListing, sbSelect, toAdminListing, toAdminUser } from '@/lib/server/admin';

const SORTS: Record<string, string> = {
  newest: 'created_at.desc',
  oldest: 'created_at.asc',
  votes: 'total_votes.desc,created_at.asc',
  today: 'day_votes.desc,created_at.asc',
};

// PostgREST filter syntax uses , ( ) * as operators, so keep them out of search text.
const cleanSearch = (s: string) => s.replace(/[,()*\\]/g, ' ').trim();

// GET ?page&limit&search&userId&platform&category&sort — every submission, newest first by default.
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20));
    const search = cleanSearch(searchParams.get('search') || '');
    const userId = searchParams.get('userId');
    const platform = searchParams.get('platform');
    const category = searchParams.get('category');
    const order = SORTS[searchParams.get('sort') || 'newest'] || SORTS.newest;

    let path = `listings?select=*&order=${order}&limit=${limit}&offset=${(page - 1) * limit}`;
    if (search) {
      const q = encodeURIComponent(`*${search}*`);
      path += `&or=(title.ilike.${q},description.ilike.${q},location.ilike.${q})`;
    }
    if (userId) path += `&user_id=eq.${encodeURIComponent(userId)}`;
    if (platform) path += `&platform=eq.${encodeURIComponent(platform)}`;
    if (category) path += `&category=eq.${encodeURIComponent(category)}`;

    const { rows, total } = await sbSelect<Parameters<typeof toAdminListing>[0]>(path);
    const listings = rows.map(toAdminListing);

    // Attach the submitter's email/name to each row.
    const userIds = [...new Set(listings.map((l) => l.userId).filter((id): id is string => Boolean(id && id !== ANONYMOUS_USER_ID)))];
    const owners = new Map<string, { email: string; name: string | null }>();
    if (userIds.length > 0) {
      const inList = userIds.map((id) => `"${id.replace(/"/g, '')}"`).join(',');
      const { rows: users } = await sbSelect<Record<string, unknown>>(
        `users?select=*&id=in.(${encodeURIComponent(inList)})`
      ).catch(() => ({ rows: [] as Record<string, unknown>[] }));
      for (const u of users) {
        const user = toAdminUser(u);
        owners.set(user.id, { email: user.email, name: user.name });
      }
    }

    return NextResponse.json({
      listings: listings.map((l) => ({ ...l, owner: (l.userId && owners.get(l.userId)) || null })),
      pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    console.error('Error fetching listings:', error);
    return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 });
  }
}

// DELETE { listingId } or { listingIds: [] } — removes the submissions and their votes.
export async function DELETE(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const ids: string[] = (body.listingIds ?? (body.listingId ? [body.listingId] : [])).filter(
      (id: unknown) => typeof id === 'string' && id
    );
    if (ids.length === 0) {
      return NextResponse.json({ error: 'Listing ID required' }, { status: 400 });
    }

    const results = await Promise.all(ids.map(removeListing));
    const removed = ids.filter((_, i) => results[i]);
    if (removed.length === 0) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, removed });
  } catch (error) {
    console.error('Error deleting listing:', error);
    return NextResponse.json({ error: 'Failed to delete listing' }, { status: 500 });
  }
}

// PATCH { listingId, title?, description?, category? }
export async function PATCH(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { listingId, title, description, category } = await req.json();
    if (!listingId) {
      return NextResponse.json({ error: 'Listing ID required' }, { status: 400 });
    }

    const changes = Object.fromEntries(
      Object.entries({ title, description, category }).filter(([, v]) => typeof v === 'string' && v)
    );
    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }
    const res = await fetch(sbUrl(`listings?id=eq.${encodeURIComponent(listingId)}`), {
      method: 'PATCH',
      headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
      body: JSON.stringify(changes),
    });
    if (!res.ok) throw new Error(await res.text());
    const [row] = await res.json();
    if (!row) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, listing: toAdminListing(row) });
  } catch (error) {
    console.error('Error updating listing:', error);
    return NextResponse.json({ error: 'Failed to update listing' }, { status: 500 });
  }
}
