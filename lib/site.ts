// Single source for the live domain and contact details shown across the site.
// NEXT_PUBLIC_SITE_URL moves canonicals, sitemap, share links and emails to another domain (e.g. https://rankbid.lol).
// Use the host that serves pages directly: www.rankbid.click redirects to the apex.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://rankbid.click').replace(/\/+$/, '');
export const SITE_HOST = new URL(SITE_URL).hostname.replace(/^www\./, '');

/** True for the live domain (rankbid.click and its subdomains), not the sandbox or other vercel.app hosts. */
export function isLiveHost(hostHeader: string | null | undefined): boolean {
  const host = (hostHeader || '').split(':')[0].toLowerCase();
  return host === SITE_HOST || host.endsWith(`.${SITE_HOST}`);
}

export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || `support@${SITE_HOST}`;
export const X_HANDLE = 'rankbidclick';
export const X_URL = `https://x.com/${X_HANDLE}`;

/** Only production deploys get indexed; previews (the sandbox) and local dev stay out of search. */
export const INDEXABLE = process.env.VERCEL_ENV === 'production';

/**
 * Where this deployment is served (NEXT_PUBLIC_APP_URL: rankbid.click in production, the sandbox URL on
 * previews). Links people follow (share links, email buttons) use it, so sandbox links stay on the sandbox.
 * Canonicals, the sitemap and share images keep SITE_URL. Same value on server and browser, so no hydration mismatch.
 */
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || SITE_URL).replace(/\/+$/, '');

/** Public share link for a listing: anyone can vote there with just a name + email. */
export function supportUrl(listingId: string): string {
  return `${APP_URL}/support/${listingId}`;
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
