// Server-only helpers for sponsored listings, ranked by price (see supabase/migrations/premium_rank_by_price.sql).
import { sbHeaders, sbUrl } from '@/lib/server/votes';

/** Rapid Gateway charges PKR; prices are set in USD and converted at this rate. */
export function usdToPkr(usd: number): number {
  const rate = Number(process.env.USD_TO_PKR) || 280;
  return Math.round(usd * rate);
}

export interface PremiumHolder {
  id: string;
  listingId: string;
  /** Live rank: highest bid first, earlier activation wins a tie. */
  position: number;
  bidUsd: number;
  activatedAt: string | null;
  expiresAt: string;
  founderName: string | null;
  founderEmail: string | null;
  founderPhone: string | null;
  founderWebsite: string | null;
  founderTwitter: string | null;
  founderLinkedin: string | null;
  founderInstagram: string | null;
  founderFacebook: string | null;
  founderTiktok: string | null;
  founderYoutube: string | null;
  founderGithub: string | null;
}

/**
 * Every live sponsored listing, ranked (expired ones are ignored).
 * revalidate: cache the read for that many seconds (public pages only; payment flows read fresh).
 */
export async function getActiveHolders(revalidate?: number): Promise<PremiumHolder[]> {
  // A cached read rounds "now" down to the minute so the URL (the cache key) stays the same.
  const now = revalidate ? new Date(Math.floor(Date.now() / 60_000) * 60_000) : new Date();
  const res = await fetch(
    sbUrl(`premium_listings?payment_status=eq.active&expires_at=gt.${encodeURIComponent(now.toISOString())}&order=bid_usd.desc,activated_at.asc&select=*`),
    revalidate ? { headers: sbHeaders(), next: { revalidate } } : { headers: sbHeaders(), cache: 'no-store' }
  );
  if (!res.ok) {
    console.error('Failed to read premium holders:', res.status, await res.text());
    return [];
  }
  const rows: any[] = await res.json();
  const holders = rows.map(r => ({
    id: r.id,
    listingId: r.listing_id,
    position: 0,
    bidUsd: Number(r.bid_usd ?? r.payment_amount ?? r.amount_paid ?? 0),
    activatedAt: r.activated_at ?? null,
    expiresAt: r.expires_at,
    founderName: r.founder_name,
    founderEmail: r.founder_email,
    founderPhone: r.founder_phone,
    founderWebsite: r.founder_website,
    founderTwitter: r.founder_twitter,
    founderLinkedin: r.founder_linkedin,
    founderInstagram: r.founder_instagram,
    founderFacebook: r.founder_facebook,
    founderTiktok: r.founder_tiktok,
    founderYoutube: r.founder_youtube,
    founderGithub: r.founder_github,
  }));
  // Sorted again here because older rows may lack bid_usd (the amount is in payment_amount).
  holders.sort((a, b) => b.bidUsd - a.bidUsd || String(a.activatedAt ?? '').localeCompare(String(b.activatedAt ?? '')));
  return holders.map((h, i) => ({ ...h, position: i + 1 }));
}

export interface ActivationResult {
  status: 'active' | 'needs_refund' | 'not_found' | string;
  position?: number;
  required?: number;
}

/** Activates a paid bid for 30 days and returns its rank. Safe to call more than once. */
export async function activatePremiumBid(premiumListingId: string): Promise<ActivationResult> {
  const res = await fetch(sbUrl('rpc/activate_premium_bid'), {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ p_id: premiumListingId }),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`activate_premium_bid failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function getPremiumListing(id: string): Promise<any | null> {
  const res = await fetch(sbUrl(`premium_listings?id=eq.${encodeURIComponent(id)}&select=*`), {
    headers: sbHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const [row] = await res.json();
  return row || null;
}

export async function updatePremiumListing(id: string, patch: Record<string, unknown>): Promise<void> {
  const res = await fetch(sbUrl(`premium_listings?id=eq.${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: sbHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    throw new Error(`Failed to update premium listing ${id}: ${res.status} ${await res.text()}`);
  }
}
