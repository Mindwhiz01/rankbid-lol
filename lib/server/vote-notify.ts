// Server-only: emails a listing's owner when it gets a vote, and the owners of listings that vote just passed.
// Ranking order matches the site: most votes first, ties go to whoever reached the count most recently.
import { sbHeaders, sbUrl } from '@/lib/server/votes';
import { rateLimit } from '@/lib/server/rate-limit';
import { sendNewVoteEmail, sendOvertakenEmail } from '@/lib/email';

/** The voted listing as it was just before the vote. */
export type VoteSnapshot = { id: string; title: string; userId: string | null; totalVotes: number; updatedAt: string | null };

/** At most this many passed listings are emailed per vote (a vote at a big tie can pass many). */
const MAX_OVERTAKEN = 10;
/** Each listing's owner hears about new votes at most once an hour, and about being passed once every 6 hours. */
const VOTE_MAIL_WINDOW = 60 * 60;
const OVERTAKEN_MAIL_WINDOW = 6 * 60 * 60;

export async function snapshotListing(listingId: string): Promise<VoteSnapshot | null> {
  const res = await fetch(sbUrl(`listings?id=eq.${encodeURIComponent(listingId)}&select=id,title,user_id,total_votes,updated_at`), {
    headers: sbHeaders(),
    cache: 'no-store',
  });
  const row = res.ok ? (await res.json())[0] : null;
  return row
    ? { id: String(row.id), title: row.title || 'Your product', userId: row.user_id ?? null, totalVotes: row.total_votes || 0, updatedAt: row.updated_at ?? null }
    : null;
}

async function countListings(filter: string): Promise<number> {
  const res = await fetch(sbUrl(`listings?select=id&${filter}`), { method: 'HEAD', headers: sbHeaders({ Prefer: 'count=exact' }), cache: 'no-store' });
  return parseInt(res.headers.get('content-range')?.split('/')[1] || '0') || 0;
}

async function ownerEmails(userIds: string[]): Promise<Map<string, { email: string; name: string | null }>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return new Map();
  const res = await fetch(sbUrl(`users?id=in.(${unique.map(encodeURIComponent).join(',')})&select=id,email,name`), { headers: sbHeaders(), cache: 'no-store' });
  const rows: { id: string; email: string | null; name: string | null }[] = res.ok ? await res.json() : [];
  return new Map(rows.filter(r => r.email).map(r => [String(r.id), { email: String(r.email).toLowerCase(), name: r.name }]));
}

/**
 * Runs after a vote has been counted. `voter` is the vote's voter id ("user:<id>" or "email:<address>"),
 * so owners aren't emailed about their own votes. Never throws.
 */
export async function notifyVote(before: VoteSnapshot, totalVotes: number, voter: string): Promise<void> {
  try {
    const v = before.totalVotes;
    // The listing now ranks first among those with its new count, so it passed every other listing at that
    // count, and the ones at its old count that were ahead of it. Listings with no votes aren't emailed.
    const passedFilters = [`and(total_votes.eq.${totalVotes},id.neq.${before.id})`];
    // Timestamps carry "+00:00", so the value is quoted and encoded (a bare "+" would arrive as a space).
    if (v > 0 && before.updatedAt) passedFilters.push(`and(total_votes.eq.${v},updated_at.gt.${encodeURIComponent(`"${before.updatedAt}"`)})`);
    const [ahead, passedRes] = await Promise.all([
      countListings(`total_votes=gt.${totalVotes}`),
      fetch(sbUrl(`listings?select=id,title,user_id,total_votes&or=(${passedFilters.join(',')})&order=total_votes.desc,updated_at.desc.nullslast&limit=${MAX_OVERTAKEN}`), {
        headers: sbHeaders(),
        cache: 'no-store',
      }),
    ]);
    const rank = ahead + 1;
    const passed: { id: string; title: string; user_id: string | null; total_votes: number }[] = passedRes.ok ? await passedRes.json() : [];

    const owners = await ownerEmails([before.userId ?? '', ...passed.map(p => p.user_id ?? '')]);
    const owner = before.userId ? owners.get(before.userId) : undefined;
    const sends: Promise<unknown>[] = [];

    const ownVote = voter === `user:${before.userId}` || (owner && voter === `email:${owner.email}`);
    if (owner && !ownVote && (await rateLimit(`vote-mail:${before.id}`, 1, VOTE_MAIL_WINDOW))) {
      sends.push(sendNewVoteEmail({ to: owner.email, listingId: before.id, productTitle: before.title, totalVotes, rank }));
    }

    // Passed listings follow the voted one in order, so their new ranks run on from its rank.
    for (const [i, p] of passed.entries()) {
      const o = p.user_id ? owners.get(p.user_id) : undefined;
      if (!o || p.user_id === before.userId) continue;
      if (!(await rateLimit(`overtaken-mail:${p.id}`, 1, OVERTAKEN_MAIL_WINDOW))) continue;
      sends.push(sendOvertakenEmail({
        to: o.email,
        listingId: p.id,
        productTitle: p.title || 'Your product',
        newRank: rank + i + 1,
        byTitle: before.title,
        votesNeeded: totalVotes + 1 - (p.total_votes || 0),
      }));
    }
    await Promise.all(sends);
  } catch (err) {
    console.error('Vote emails failed:', err);
  }
}
