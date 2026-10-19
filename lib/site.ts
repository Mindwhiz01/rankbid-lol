// Single source for the live domain and contact details shown across the site.
// NEXT_PUBLIC_SITE_URL moves canonicals, sitemap, share links and emails to another domain (e.g. https://rankbid.lol).
// Use the host that serves pages directly: www.rankbid.click redirects to the apex.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://rankbid.click').replace(/\/+$/, '');
export const SITE_HOST = new URL(SITE_URL).hostname.replace(/^www\./, '');

export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || `support@${SITE_HOST}`;
export const X_HANDLE = 'rankbidclick';
export const X_URL = `https://x.com/${X_HANDLE}`;

/** Only production deploys get indexed; previews (the sandbox) and local dev stay out of search. */
export const INDEXABLE = process.env.VERCEL_ENV === 'production';

/** Public share link for a listing: anyone can vote there with just a name + email. */
export function supportUrl(listingId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : SITE_URL;
  return `${origin}/support/${listingId}`;
}

/**
 * LinkedIn post composer with the text already written. The link inside the text still
 * becomes LinkedIn's preview card (image + title from the page's Open Graph tags), so the
 * post gets text, image and link. share-offsite only takes a URL and leaves the text empty.
 */
export function linkedInShareUrl(text: string, url: string): string {
  const body = text.includes(url) ? text : `${text}\n\n${url}`;
  return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(body)}`;
}
