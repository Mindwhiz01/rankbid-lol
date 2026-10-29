// Server-only: guest votes from /support links count once the voter clicks the link we email them.
// Pending requests live in `pending_support_votes`; only a SHA-256 hash of each token is stored.
import { createHash, randomBytes } from 'crypto';
import { sbHeaders, sbUrl } from '@/lib/server/votes';

const CONFIRM_TTL_MS = 24 * 60 * 60 * 1000;

export type SupportType = 'founder' | 'friend' | 'supporter';

export interface PendingSupportVote {
  listing_id: string;
  voter_id: string;
  name: string;
  email: string;
  support_type: SupportType;
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** True when this voter already has a counted vote on the listing. */
export async function hasCountedVote(listingId: string, voterId: string): Promise<boolean> {
  const res = await fetch(
    sbUrl(`votes?listing_id=eq.${encodeURIComponent(listingId)}&voter_id=eq.${encodeURIComponent(voterId)}&select=id&limit=1`),
    { headers: sbHeaders(), cache: 'no-store' }
  );
  if (!res.ok) throw new Error(`Vote lookup failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

/** Saves a pending vote (replacing this voter's earlier open request) and returns its confirmation link. */
export async function createPendingSupportVote(vote: PendingSupportVote, baseUrl: string): Promise<string> {
  await fetch(
    sbUrl(`pending_support_votes?listing_id=eq.${encodeURIComponent(vote.listing_id)}&voter_id=eq.${encodeURIComponent(vote.voter_id)}&used_at=is.null`),
    { method: 'DELETE', headers: sbHeaders() }
  );
  const token = randomBytes(32).toString('base64url');
  const res = await fetch(sbUrl('pending_support_votes'), {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify({ ...vote, token_hash: hashToken(token), expires_at: new Date(Date.now() + CONFIRM_TTL_MS).toISOString() }),
  });
  if (!res.ok) throw new Error(`Saving pending vote failed: ${res.status} ${await res.text()}`);
  return `${baseUrl.replace(/\/+$/, '')}/support/confirm?token=${token}`;
}

/** Uses a confirmation token once. Returns the pending vote, or null when it's unknown, used or expired. */
export async function claimPendingSupportVote(token: string): Promise<PendingSupportVote | null> {
  const now = new Date().toISOString();
  const res = await fetch(
    sbUrl(`pending_support_votes?token_hash=eq.${hashToken(token)}&used_at=is.null&expires_at=gt.${encodeURIComponent(now)}`),
    {
      method: 'PATCH',
      headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
      body: JSON.stringify({ used_at: now }),
    }
  );
  if (!res.ok) throw new Error(`Pending vote lookup failed: ${res.status} ${await res.text()}`);
  const [row] = await res.json();
  return row ?? null;
}
