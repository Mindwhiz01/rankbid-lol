// Shared SEO copy and schema.org builders. Keep the brand description identical everywhere
// (metadata, JSON-LD, llms.txt) so search engines and LLMs see one consistent positioning.
import type { Metadata } from 'next';
import { SITE_URL, SUPPORT_EMAIL, X_HANDLE, X_URL } from '@/lib/site';

export const SITE_NAME = 'RankBid';
export const SITE_TAGLINE = 'Free community-voted product rankings';
export const SITE_DESCRIPTION =
  'RankBid is a free product launch platform where real people vote and the most-voted products, websites and creator profiles rise to the top of a live leaderboard. Rankings come from public vote counts, not algorithms. Makers can also bid for one of ten clearly labeled sponsored spots, starting at $1.';

export const absoluteUrl = (path = '/') => new URL(path, SITE_URL).toString();

/** Per-page metadata with a canonical URL and matching Open Graph / X card tags. */
export function pageMetadata({ title, description, path, noindex = false }: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: SITE_NAME, type: 'website' },
    twitter: { card: 'summary_large_image', site: `@${X_HANDLE}`, title, description },
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
