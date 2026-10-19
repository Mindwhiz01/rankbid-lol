import type { MetadataRoute } from 'next';
import { CATEGORIES, LEGACY_CATEGORIES, categoryPath } from '@/lib/categories';
import { getRankedListings } from '@/lib/server/listings';
import { getCustomCategories } from '@/lib/server/custom-categories';
import { absoluteUrl } from '@/lib/seo';

// Indexable public pages only. Members-only pages (MEMBERS_ONLY in proxy.ts), search and
// account pages are left out.
const STATIC_PAGES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/', priority: 1, changeFrequency: 'hourly' },
  { path: '/categories', priority: 0.9, changeFrequency: 'daily' },
  { path: '/leaderboard', priority: 0.9, changeFrequency: 'hourly' },
  { path: '/sponsored', priority: 0.7, changeFrequency: 'hourly' },
  { path: '/today', priority: 0.8, changeFrequency: 'hourly' },
  { path: '/daily', priority: 0.7, changeFrequency: 'hourly' },
  { path: '/archive', priority: 0.7, changeFrequency: 'daily' },
  { path: '/stats', priority: 0.5, changeFrequency: 'daily' },
  { path: '/why', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/faq', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/platforms', priority: 0.7, changeFrequency: 'daily' },
  { path: '/rules', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/tos', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/cookies', priority: 0.2, changeFrequency: 'yearly' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [listings, custom] = await Promise.all([getRankedListings(), getCustomCategories()]);
  const now = new Date();

  return [
    ...STATIC_PAGES.map(p => ({ url: absoluteUrl(p.path), lastModified: now, changeFrequency: p.changeFrequency, priority: p.priority })),
    ...[...CATEGORIES, ...LEGACY_CATEGORIES, ...custom].map(c => ({ url: absoluteUrl(categoryPath(c)), lastModified: now, changeFrequency: 'daily' as const, priority: 0.8 })),
    ...listings.map(l => ({ url: absoluteUrl(`/product/${l.id}`), lastModified: new Date(l.updatedAt), changeFrequency: 'daily' as const, priority: 0.6 })),
  ];
}
