// Product logos are served from RankBid (/api/logo, cached on the CDN), so visitors' browsers never
// contact Google's favicon service. Logos saved as Google favicon URLs are rewritten on the way out.

const SIZES = [16, 32, 64, 128, 256] as const;

/** Logo for a hostname, at the nearest supported size. */
export function logoUrl(host: string, size = 64): string {
  const sz = SIZES.find(s => s >= size) ?? 256;
  return `/api/logo?domain=${encodeURIComponent(host.toLowerCase())}&sz=${sz}`;
}

/** Logo for a page URL, or null when the URL can't be parsed. */
export function logoForUrl(url: string | null | undefined, size = 64): string | null {
  try {
    return url ? logoUrl(new URL(url).hostname, size) : null;
  } catch {
    return null;
  }
}

/** A stored image URL, with Google favicon links swapped for our own logo route. */
export function selfHostedImage(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!/^https:\/\/www\.google\.com\/s2\/favicons\?/i.test(url)) return url;
  try {
    const u = new URL(url);
    const domain = u.searchParams.get('domain');
    return domain ? logoUrl(domain, Number(u.searchParams.get('sz')) || 64) : null;
  } catch {
    return null;
  }
}
