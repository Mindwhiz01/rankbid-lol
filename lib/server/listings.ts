// Server-only listing reads for pages that render rankings into the HTML (product, category,
// sitemap), so search engines and AI crawlers that don't run JavaScript still see the data.
import { cache } from 'react';
import { sbHeaders, sbUrl, supabaseConfigured } from '@/lib/server/votes';

export interface Listing {
  id: string;
  title: string;
  description: string;
  url: string;
  category: string;
  platform: string;
  totalVotes: number;
  dayVotes: number;
  clickCount: number;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

type Row = {
  id: string; title: string; description?: string | null; url?: string | null; location?: string | null;
  category?: string | null; platform?: string | null; total_votes?: number | null; day_votes?: number | null;
  click_count?: number | null; image_url?: string | null; created_at: string; updated_at?: string | null;
};

function toListing(row: Row): Listing {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    url: row.location || row.url || '',
    category: row.category || 'Other',
    platform: row.platform || 'website',
    totalVotes: row.total_votes || 0,
    dayVotes: row.day_votes || 0,
    clickCount: row.click_count || 0,
    ...(row.image_url && { imageUrl: row.image_url }),
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

// Same order as the site's rankings: most votes first, ties go to whoever reached the count most recently.
const RANK_ORDER = 'order=total_votes.desc,updated_at.desc.nullslast';

// Pages that render these are cached (ISR) for the same window, so a busy page reads Supabase
// about once a minute instead of on every visit. The browser views refetch live data on mount.
export const LISTINGS_REVALIDATE = 60;

async function query(path: string): Promise<Listing[]> {
  if (!supabaseConfigured()) return [];
  try {
    const res = await fetch(sbUrl(path), { headers: sbHeaders(), next: { revalidate: LISTINGS_REVALIDATE } });
    if (!res.ok) return [];
    const rows: Row[] = await res.json();
    return rows.map(toListing);
  } catch {
    return [];
  }
}

// Cached per request: generateMetadata and the page both ask for the same listing.
export const getListingById = cache(async (id: string): Promise<Listing | null> => {
  const rows = await query(`listings?id=eq.${encodeURIComponent(id)}&select=*`);
  return rows[0] ?? null;
});

/** Every listing in ranking order. */
export function getRankedListings(): Promise<Listing[]> {
  return query(`listings?select=*&${RANK_ORDER}`);
}

export function getCategoryListings(category: string, limit = 50): Promise<Listing[]> {
  return query(`listings?select=*&category=eq.${encodeURIComponent(category)}&${RANK_ORDER}&limit=${limit}`);
}

/** Listings with votes in the last 24 hours, most of today's votes first (the /today board). */
export function getTrendingToday(limit = 100): Promise<Listing[]> {
  return query(`listings?select=*&day_votes=gt.0&order=day_votes.desc,updated_at.desc.nullslast&limit=${limit}`);
}

/** Listings submitted today (UTC), most of today's votes first (the /daily board). */
export function getLaunchedToday(limit = 100): Promise<Listing[]> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const range = `created_at=gte.${encodeURIComponent(start.toISOString())}&created_at=lt.${encodeURIComponent(end.toISOString())}`;
  return query(`listings?select=*&${range}&order=day_votes.desc,updated_at.desc.nullslast&limit=${limit}`);
}
