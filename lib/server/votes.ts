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
  const id = encodeURIComponent(listingId);
  const voter = encodeURIComponent(voterId);

  const checkRes = await fetch(sbUrl(`votes?listing_id=eq.${id}&voter_id=eq.${voter}&select=id`), { headers: sbHeaders() });
  const existing = await checkRes.json();
  if (Array.isArray(existing) && existing.length > 0) {
    return { status: 'duplicate' };
  }

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
  // 409: a concurrent request already recorded this voter (unique index on listing_id, voter_id).
  if (insertRes.status === 409) {
    return { status: 'duplicate' };
  }
  if (!insertRes.ok) {
    throw new Error(`Failed to insert vote: ${await insertRes.text()}`);
  }

  const { totalVotes, dayVotes } = await refreshCounts(listingId, { updated_at: new Date().toISOString() });
  return { status: 'ok', totalVotes, dayVotes };
}

/** Recounts a listing's votes from the `votes` table and saves the totals on the listing. */
async function refreshCounts(listingId: string, extra: Record<string, string> = {}) {
  const id = encodeURIComponent(listingId);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
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

/** Takes back `voterId`'s vote on a listing and refreshes its counts. */
export async function removeVote(listingId: string, voterId: string): Promise<{ totalVotes: number; dayVotes: number }> {
  const res = await fetch(
    sbUrl(`votes?listing_id=eq.${encodeURIComponent(listingId)}&voter_id=eq.${encodeURIComponent(voterId)}`),
    { method: 'DELETE', headers: sbHeaders({ Prefer: 'return=minimal' }) }
  );
  if (!res.ok) throw new Error(`Failed to delete vote: ${await res.text()}`);
  return refreshCounts(listingId);
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
