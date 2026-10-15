// Single source for contact details shown across the site.
export const SUPPORT_EMAIL = 'support@rankbid.com';
export const X_HANDLE = 'rankbidclick';
export const X_URL = `https://x.com/${X_HANDLE}`;

export const SITE_URL = 'https://www.rankbid.click';

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
