// Server-only: emails a listing's owner when it gets a vote, and the owners of listings that vote just passed.
// Ranking order matches the site: most votes first, ties go to whichever reached that count first (queue order).
import { sbHeaders, sbUrl } from '@/lib/server/votes';
import { rateLimit } from '@/lib/server/rate-limit';
import { sendNewVoteEmail, sendOvertakenEmail } from '@/lib/email';

/** The voted listing as it was just before the vote. */
export type VoteSnapshot = { id: string; title: string; userId: string | null; totalVotes: number; reachedAt: string };

/** At most this many passed listings are emailed per vote (a vote at a big tie can pass many). */
const MAX_OVERTAKEN = 10;
/** Each listing's owner hears about new votes at most once an hour. Being passed is emailed every time. */
const VOTE_MAIL_WINDOW = 60 * 60;
/** Gap between overtaken emails, to stay under Resend's per-second rate limit. */
const SEND_GAP_MS = 600;

export async function snapshotListing(listingId: string): Promise<VoteSnapshot | null> {
  const res = await fetch(sbUrl(`listings?id=eq.${encodeURIComponent(listingId)}&select=id,title,user_id,total_votes,created_at,rank_reached_at`), {
    headers: sbHeaders(),
    cache: 'no-store',
  });
  const row = res.ok ? (await res.json())[0] : null;
  return row
    ? { id: String(row.id), title: row.title || 'Your product', userId: row.user_id ?? null, totalVotes: row.total_votes || 0, reachedAt: String(row.rank_reached_at || row.created_at) }
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
    // Timestamps carry "+00:00", so the value is quoted and encoded (a bare "+" would arrive as a space).
    const reached = encodeURIComponent(`"${before.reachedAt}"`);
    // Ties rank in queue order, so the voted listing joins the end of its new count: it passed only the
    // listings at its old count that were ahead of it (including listings with no votes yet).
    const [ahead, passedRes] = await Promise.all([
      countListings(`total_votes=gte.${totalVotes}&id=neq.${encodeURIComponent(before.id)}`),
      totalVotes > v
        ? fetch(sbUrl(`listings?select=id,title,user_id,total_votes&total_votes=eq.${v}&rank_reached_at=lt.${reached}&id=neq.${encodeURIComponent(before.id)}&order=rank_reached_at.asc&limit=${MAX_OVERTAKEN}`), {
            headers: sbHeaders(),
            cache: 'no-store',
          })
        : null,
    ]);
    const rank = ahead + 1;
    const passed: { id: string; title: string; user_id: string | null; total_votes: number }[] = passedRes?.ok ? await passedRes.json() : [];

    const owners = await ownerEmails([before.userId ?? '', ...passed.map(p => p.user_id ?? '')]);
    const owner = before.userId ? owners.get(before.userId) : undefined;

    const ownVote = voter === `user:${before.userId}` || (owner && voter === `email:${owner.email}`);
    if (owner && !ownVote && (await rateLimit(`vote-mail:${before.id}`, 1, VOTE_MAIL_WINDOW))) {
      await sendNewVoteEmail({ to: owner.email, listingId: before.id, productTitle: before.title, totalVotes, rank });
    }

    // Passed listings follow the voted one in order, so their new ranks run on from its rank.
    // Sent one at a time: a burst of parallel sends gets rate limited and the alerts are lost.
    for (const [i, p] of passed.entries()) {
      const o = p.user_id ? owners.get(p.user_id) : undefined;
      if (!o || p.user_id === before.userId) continue;
      await new Promise(r => setTimeout(r, SEND_GAP_MS));
      await sendOvertakenEmail({
        to: o.email,
        listingId: p.id,
        productTitle: p.title || 'Your product',
        newRank: rank + i + 1,
        byTitle: before.title,
        // Tying would put it behind in the queue, so it has to pass.
        votesNeeded: totalVotes + 1 - (p.total_votes || 0),
      });
    }
  } catch (err) {
    console.error('Vote emails failed:', err);
  }
}
