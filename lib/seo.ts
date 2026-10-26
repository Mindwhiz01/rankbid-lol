// Shared SEO copy and schema.org builders. Keep the brand description identical everywhere
// (metadata, JSON-LD, llms.txt) so search engines and LLMs see one consistent positioning.
import type { Metadata } from 'next';
import { SITE_URL, SUPPORT_EMAIL, X_HANDLE, X_URL } from '@/lib/site';

export const SITE_NAME = 'RankBid';
export const SITE_TAGLINE = 'Free community-voted product rankings';
// About 155 characters, so search results show it whole.
export const SITE_DESCRIPTION =
  'Free product launch platform: real people vote and the most-voted products rise to the top of a live leaderboard. Clearly labeled sponsored spots from $1.';

export const absoluteUrl = (path = '/') => new URL(path, SITE_URL).toString();

/** Branded share card (app/opengraph-image.tsx) for every page that has no image of its own. */
export const DEFAULT_SHARE_IMAGE = { url: '/opengraph-image', width: 1200, height: 630, alt: `${SITE_NAME}: ${SITE_TAGLINE}` };

/** Shortens `text` to at most `max` characters at a word boundary, ending in "…" when cut. */
export function clip(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1).replace(/\s+\S*$/, '').replace(/[\s.,;:!?–-]+$/, '');
  return `${cut || t.slice(0, max - 1)}…`;
}

/**
 * Per-page metadata with a canonical URL and matching Open Graph / X card tags. Titles are kept to about
 * 60 characters with the " | RankBid" suffix and descriptions to 155, so search results show them whole.
 */
export function pageMetadata({ title: fullTitle, description: fullDescription, path, noindex = false }: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}): Metadata {
  const title = clip(fullTitle, 50);
  const description = clip(fullDescription, 155);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: SITE_NAME, type: 'website', images: [DEFAULT_SHARE_IMAGE] },
    twitter: { card: 'summary_large_image', site: `@${X_HANDLE}`, title, description, images: [DEFAULT_SHARE_IMAGE] },
    ...(noindex && { robots: { index: false, follow: true } }),
  };
}

export const organizationSchema = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  logo: absoluteUrl('/brand/logo.png'),
  description: SITE_DESCRIPTION,
  email: SUPPORT_EMAIL,
  sameAs: [X_URL],
};

export const websiteSchema = {
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  publisher: { '@id': `${SITE_URL}/#organization` },
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
};

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqSchema(faqs: { q: string; a: string }[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function itemListSchema(name: string, items: { id: string; title: string }[]) {
  return {
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.title,
      url: absoluteUrl(`/product/${item.id}`),
    })),
  };
}
