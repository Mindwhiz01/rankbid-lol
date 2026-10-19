// Server-only: is this link already listed, however it was typed?
import { hostOf, listingUrlKey } from '@/lib/platform-url';
import { sbHeaders, sbUrl } from '@/lib/server/votes';

/**
 * Id of an existing listing whose link is the same as `url` (see listingUrlKey), or null.
 * Throws if the lookup fails, so callers refuse the link rather than risk a duplicate.
 * Listings on the same host are fetched and compared by key, so "http://www.MindWhiz.com"
 * matches a stored "https://mindwhiz.com/".
 */
export async function findDuplicateListing(url: string, excludeId?: string): Promise<string | null> {
  const key = listingUrlKey(url);
  const host = hostOf(url);
  if (!key || !host) return null;

  const hosts = host === 'twitter.com' || host === 'x.com' ? ['twitter.com', 'x.com'] : [host];
  const or = hosts.map(h => `location.ilike.*${h}*`).join(',');
  const res = await fetch(
    sbUrl(`listings?or=(${encodeURIComponent(or)})&select=id,location&limit=2000${excludeId ? `&id=neq.${encodeURIComponent(excludeId)}` : ''}`),
    { headers: sbHeaders(), cache: 'no-store' }
  );
  if (!res.ok) {
    // Fail closed: an unchecked link could be a duplicate.
    throw new Error(`Duplicate listing check failed: ${res.status} ${await res.text()}`);
  }
  const rows: { id: string; location: string | null }[] = await res.json();
  return rows.find(r => r.location && listingUrlKey(r.location) === key)?.id ?? null;
}
