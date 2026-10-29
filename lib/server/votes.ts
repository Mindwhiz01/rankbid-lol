// Server-only vote helpers shared by /api/votes and /api/support-vote.
// Votes live in the `votes` table; listing totals are recounted from it after each vote.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function supabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseKey);
}

export function sbHeaders(extra: Record<string, string> = {}): HeadersInit {
  return {
    apikey: supabaseKey as string,
    Authorization: `Bearer ${supabaseKey}`,
    ...extra,
  };
}

export function sbUrl(path: string): string {
  return `${supabaseUrl}/rest/v1/${path}`;
}

async function countRows(query: string): Promise<number> {
  const res = await fetch(sbUrl(query), { headers: sbHeaders({ Prefer: 'count=exact' }) });
  return parseInt(res.headers.get('content-range')?.split('/')[1] || '0');
}

export type RecordVoteResult =
  | { status: 'ok'; totalVotes: number; dayVotes: number }
  | { status: 'duplicate' };

/** Records one vote for `voterId` on a listing (one per voter) and refreshes the listing's counts. */
export async function recordVote(listingId: string, voterId: string): Promise<RecordVoteResult> {
  // No lookup first: the unique index on (listing_id, voter_id) refuses a second vote with 409.
  const insertRes = await fetch(sbUrl('votes'), {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify({
      id: `vote_${crypto.randomUUID()}`,
      listing_id: listingId,
      voter_id: voterId,
      voted_at: new Date().toISOString(),
    }),
  });
  // 409: this voter already voted on it (unique index on listing_id, voter_id).
  if (insertRes.status === 409) {
    return { status: 'duplicate' };
  }
  if (!insertRes.ok) {
    throw new Error(`Failed to insert vote: ${await insertRes.text()}`);
  }

  // The listing joins the end of the queue at its new count.
  const { totalVotes, dayVotes } = await refreshCounts(listingId, true);
  return { status: 'ok', totalVotes, dayVotes };
}

/**
 * Recounts a listing's votes from the `votes` table and saves the totals on the listing, which rejoins the
 * queue at its new count. refresh_listing_counts (supabase/migrations/vote_counts_and_guest_confirm.sql)
 * does it in one locked step, so simultaneous votes can't save or report a stale total.
 */
async function refreshCounts(listingId: string, added: boolean) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const rpc = await fetch(sbUrl('rpc/refresh_listing_counts'), {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ p_listing_id: listingId, p_day_start: today.toISOString(), p_added: added }),
    cache: 'no-store',
  });
  if (rpc.ok) {
    const row = await rpc.json().catch(() => null);
    if (typeof row?.total_votes === 'number' && typeof row?.day_votes === 'number') {
      return { totalVotes: row.total_votes as number, dayVotes: row.day_votes as number };
    }
  } else if (rpc.status !== 404) {
    console.error('refresh_listing_counts failed:', rpc.status, await rpc.text());
  }

  // The function isn't installed: count, then save.
  const id = encodeURIComponent(listingId);
  const now = new Date().toISOString();
  const extra: Record<string, string> = added ? { updated_at: now, rank_reached_at: now } : { rank_reached_at: now };
  const [totalVotes, dayVotes] = await Promise.all([
    countRows(`votes?listing_id=eq.${id}&select=id`),
    countRows(`votes?listing_id=eq.${id}&voted_at=gte.${today.toISOString()}&select=id`),
  ]);

  const updateRes = await fetch(sbUrl(`listings?id=eq.${id}`), {
    method: 'PATCH',
    headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify({ total_votes: totalVotes, day_votes: dayVotes, ...extra }),
  });
  if (!updateRes.ok) {
    console.error('Failed to update listing vote counts:', await updateRes.text());
  }
  return { totalVotes, dayVotes };
}

/**
 * Takes back `voterId`'s vote on a listing and refreshes its counts. The listing drops to the end of the
 * queue at its lower count; back at zero votes it returns to its submission-date spot.
 */
export async function removeVote(listingId: string, voterId: string): Promise<{ totalVotes: number; dayVotes: number }> {
  const id = encodeURIComponent(listingId);
  const res = await fetch(
    sbUrl(`votes?listing_id=eq.${id}&voter_id=eq.${encodeURIComponent(voterId)}`),
    { method: 'DELETE', headers: sbHeaders({ Prefer: 'return=minimal' }) }
  );
  if (!res.ok) throw new Error(`Failed to delete vote: ${await res.text()}`);
  const counts = await refreshCounts(listingId, false);
  if (counts.totalVotes === 0) {
    const row = await fetch(sbUrl(`listings?id=eq.${id}&select=created_at`), { headers: sbHeaders() }).then(r => (r.ok ? r.json() : []));
    if (row[0]?.created_at) {
      await fetch(sbUrl(`listings?id=eq.${id}`), {
        method: 'PATCH',
        headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify({ rank_reached_at: row[0].created_at }),
      });
    }
  }
  return counts;
}

export interface PublicListing {
  id: string;
  title: string;
  description: string;
  url: string;
  category: string;
  platform: string;
  totalVotes: number;
}

/** Public fields of one listing, or null if it doesn't exist. */
export async function getListing(listingId: string): Promise<PublicListing | null> {
  if (!supabaseConfigured()) return null;
  const res = await fetch(sbUrl(`listings?id=eq.${encodeURIComponent(listingId)}&select=*`), {
    headers: sbHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const rows = await res.json();
  const row = rows?.[0];
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    url: row.location || row.url || '',
    category: row.category || 'Other',
    platform: row.platform || 'website',
    totalVotes: row.total_votes || 0,
  };
}
