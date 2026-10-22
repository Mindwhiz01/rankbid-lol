// Server-only: emails a listing's owner when it gets a vote, and the owners of listings that vote just passed.
// Ranking order matches the site: most votes first, ties go to the listing submitted first.
import { sbHeaders, sbUrl } from '@/lib/server/votes';
import { rateLimit } from '@/lib/server/rate-limit';
import { sendNewVoteEmail, sendOvertakenEmail } from '@/lib/email';

/** The voted listing as it was just before the vote. */
export type VoteSnapshot = { id: string; title: string; userId: string | null; totalVotes: number; createdAt: string };

/** At most this many passed listings are emailed per vote (a vote at a big tie can pass many). */
const MAX_OVERTAKEN = 10;
/** Each listing's owner hears about new votes at most once an hour. Being passed is emailed every time. */
const VOTE_MAIL_WINDOW = 60 * 60;
/** Gap between overtaken emails, to stay under Resend's per-second rate limit. */
const SEND_GAP_MS = 600;

export async function snapshotListing(listingId: string): Promise<VoteSnapshot | null> {
  const res = await fetch(sbUrl(`listings?id=eq.${encodeURIComponent(listingId)}&select=id,title,user_id,total_votes,created_at`), {
    headers: sbHeaders(),
    cache: 'no-store',
  });
  const row = res.ok ? (await res.json())[0] : null;
  return row
    ? { id: String(row.id), title: row.title || 'Your product', userId: row.user_id ?? null, totalVotes: row.total_votes || 0, createdAt: String(row.created_at) }
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
    const created = encodeURIComponent(`"${before.createdAt}"`);
    // Older listings win ties, so the vote passed the newer listings at its new count, and the older ones
    // at its old count (including listings with no votes yet).
    const passedFilters = totalVotes > v
      ? [`and(total_votes.eq.${totalVotes},created_at.gt.${created})`, `and(total_votes.eq.${v},created_at.lt.${created})`]
      : [];
    const [ahead, passedRes] = await Promise.all([
      countListings(`or=(total_votes.gt.${totalVotes},and(total_votes.eq.${totalVotes},created_at.lt.${created}))`),
      passedFilters.length
        ? fetch(sbUrl(`listings?select=id,title,user_id,total_votes,created_at&or=(${passedFilters.join(',')})&order=total_votes.desc,created_at.asc&limit=${MAX_OVERTAKEN}`), {
            headers: sbHeaders(),
            cache: 'no-store',
          })
        : null,
    ]);
    const rank = ahead + 1;
    const passed: { id: string; title: string; user_id: string | null; total_votes: number; created_at: string }[] = passedRes?.ok ? await passedRes.json() : [];

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
      // An older listing takes the spot back by tying; a newer one has to pass.
      const olderThanVoted = new Date(p.created_at).getTime() < new Date(before.createdAt).getTime();
      await sendOvertakenEmail({
        to: o.email,
        listingId: p.id,
        productTitle: p.title || 'Your product',
        newRank: rank + i + 1,
        byTitle: before.title,
        votesNeeded: totalVotes - (p.total_votes || 0) + (olderThanVoted ? 0 : 1),
      });
    }
  } catch (err) {
    console.error('Vote emails failed:', err);
  }
}
