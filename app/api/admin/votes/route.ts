import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest, sbSelect, toAdminUser } from '@/lib/server/admin';
import { logAdminActivity } from '@/lib/server/admin-activity';
import { removeVote, sbHeaders, sbUrl } from '@/lib/server/votes';

// voter_id is "user:<user id>" for signed-in votes and "email:<email>" for guest votes from a
// /support link (their name and support type live in `supporters`). Anything else is a legacy id.
type VoteRow = { id: string; listing_id: string; voter_id: string; voted_at?: string | null; created_at?: string | null };
type SupporterRow = { listing_id: string; email: string; name: string; support_type: string };

export interface AdminVoter {
  voteId: string;
  kind: 'user' | 'guest' | 'unknown';
  email: string | null;
  name: string | null;
  supportType: string | null;
  userId: string | null;
  votedAt: string | null;
  listing: { id: string; title: string; platform: string } | null;
}

const inList = (values: string[]) => encodeURIComponent(values.map((v) => `"${v.replace(/"/g, '')}"`).join(','));
// PostgREST filter syntax uses , ( ) * as operators, so keep them out of search text.
const cleanSearch = (s: string) => s.replace(/[,()*\\"]/g, ' ').trim();

// GET ?listingId&search&page&limit — votes newest first, with who cast each one and on which submission.
// listingId narrows to one submission; search matches the voter's email or name.
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const listingId = searchParams.get('listingId');
    const search = cleanSearch(searchParams.get('search') || '');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25') || 25));

    let path = `votes?select=*&order=voted_at.desc.nullslast&limit=${limit}&offset=${(page - 1) * limit}`;
    if (listingId) path += `&listing_id=eq.${encodeURIComponent(listingId)}`;
    if (search) {
      // Account votes are matched through the users table; guest votes carry the email in voter_id.
      const q = encodeURIComponent(`*${search}*`);
      const { rows: matched } = await sbSelect<{ id: string }>(
        `users?select=id&or=(email.ilike.${q},name.ilike.${q})&limit=200`
      ).catch(() => ({ rows: [] as { id: string }[] }));
      const ors = [`voter_id.ilike.${q}`];
      if (matched.length) ors.push(`voter_id.in.(${inList(matched.map((u) => `user:${u.id}`))})`);
      path += `&or=(${ors.join(',')})`;
    }

    const { rows, total } = await sbSelect<VoteRow>(path);

    const userIds = [...new Set(rows.filter((v) => v.voter_id.startsWith('user:')).map((v) => v.voter_id.slice(5)))];
    const emails = [...new Set(rows.filter((v) => v.voter_id.startsWith('email:')).map((v) => v.voter_id.slice(6)))];
    const listingIds = [...new Set(rows.map((v) => v.listing_id))];

    const [users, supporters, listings] = await Promise.all([
      userIds.length
        ? sbSelect<Record<string, unknown>>(`users?select=*&id=in.(${inList(userIds)})`).catch(() => ({ rows: [] }))
        : { rows: [] },
      emails.length
        ? sbSelect<SupporterRow>(
            `supporters?email=in.(${inList(emails)})&listing_id=in.(${inList(listingIds)})&select=listing_id,email,name,support_type`
          ).catch(() => ({ rows: [] as SupporterRow[] }))
        : { rows: [] as SupporterRow[] },
      listingIds.length
        ? sbSelect<{ id: string; title: string; platform: string | null }>(
            `listings?select=id,title,platform&id=in.(${inList(listingIds)})`
          ).catch(() => ({ rows: [] as { id: string; title: string; platform: string | null }[] }))
        : { rows: [] as { id: string; title: string; platform: string | null }[] },
    ]);

    const userById = new Map(users.rows.map((u) => { const a = toAdminUser(u); return [a.id, a]; }));
    const supporterByKey = new Map(supporters.rows.map((s) => [`${s.listing_id}|${s.email}`, s]));
    const listingById = new Map(listings.rows.map((l) => [l.id, { id: l.id, title: l.title, platform: l.platform || 'website' }]));

    const voters: AdminVoter[] = rows.map((v) => {
      const base = { voteId: v.id, votedAt: v.voted_at || v.created_at || null, listing: listingById.get(v.listing_id) || null };
      if (v.voter_id.startsWith('user:')) {
        const userId = v.voter_id.slice(5);
        const u = userById.get(userId);
        return { ...base, kind: 'user', email: u?.email || null, name: u?.name || null, supportType: null, userId };
      }
      if (v.voter_id.startsWith('email:')) {
        const email = v.voter_id.slice(6);
        const s = supporterByKey.get(`${v.listing_id}|${email}`);
        return { ...base, kind: 'guest', email, name: s?.name || null, supportType: s?.support_type || null, userId: null };
      }
      return { ...base, kind: 'unknown', email: null, name: v.voter_id, supportType: null, userId: null };
    });

    return NextResponse.json({
      voters,
      pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    console.error('Error fetching votes:', error);
    return NextResponse.json({ error: 'Failed to fetch votes' }, { status: 500 });
  }
}

// DELETE { voteIds, reason }: removes votes (e.g. fraud), refreshes each listing's counts and rank,
// and logs every removed vote with the reason.
export async function DELETE(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const voteIds: string[] = Array.isArray(body?.voteIds) ? body.voteIds.filter((v: unknown): v is string => typeof v === 'string').slice(0, 100) : [];
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 200) : '';
  if (!voteIds.length) return NextResponse.json({ error: 'Choose at least one vote' }, { status: 400 });
  if (!reason) return NextResponse.json({ error: 'Give a reason for removing these votes' }, { status: 400 });

  try {
    const { rows } = await sbSelect<VoteRow>(`votes?select=*&id=in.(${inList(voteIds)})`);
    const removed: string[] = [];
    // One at a time: each removal recounts its listing, and two votes may share one.
    for (const v of rows) {
      await removeVote(v.listing_id, v.voter_id);
      if (v.voter_id.startsWith('email:')) {
        await fetch(sbUrl(`supporters?listing_id=eq.${encodeURIComponent(v.listing_id)}&email=eq.${encodeURIComponent(v.voter_id.slice(6))}`), {
          method: 'DELETE',
          headers: sbHeaders(),
        }).catch(() => null);
      }
      await logAdminActivity(req, 'vote.delete', v.listing_id, { reason, vote: v });
      removed.push(v.id);
    }
    return NextResponse.json({ removed });
  } catch (error) {
    console.error('Error removing votes:', error);
    return NextResponse.json({ error: 'Failed to remove votes' }, { status: 500 });
  }
}
