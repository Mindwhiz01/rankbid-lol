import CategoryBrowser from '@/components/CategoryBrowser';
import JsonLd from '@/components/JsonLd';
import { CATEGORIES, categoryPath, getCategoryLabel } from '@/lib/categories';
import { getRankedListings } from '@/lib/server/listings';
import { getCustomCategories } from '@/lib/server/custom-categories';
import { absoluteUrl, breadcrumbSchema, itemListSchema, pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Product Categories: Community Rankings',
  description: `Browse ${CATEGORIES.length} product categories on RankBid, from AI and marketing to developer tools and crypto. Every category is ranked live by community votes.`,
  path: '/categories',
});

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const { page } = await searchParams;
  const [listings, custom] = await Promise.all([getRankedListings(), getCustomCategories()]);
  const counts: Record<string, number> = {};
  for (const l of listings) counts[l.category] = (counts[l.category] || 0) + 1;
  const top = listings.slice(0, 50);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([{ name: 'Categories', path: '/categories' }]),
          {
            '@type': 'CollectionPage',
            name: 'RankBid product categories',
            url: absoluteUrl('/categories'),
            hasPart: [...CATEGORIES, ...custom].map(c => ({ '@type': 'CollectionPage', name: `${getCategoryLabel(c)} products`, url: absoluteUrl(categoryPath(c)) })),
          },
          itemListSchema('Top products on RankBid', top),
        ]}
      />
      <CategoryBrowser
        selected={null}
        listings={listings}
        page={Number(page) || 1}
        counts={counts}
        custom={custom}
        intro={`RankBid groups every launched product into ${CATEGORIES.length} categories. Each category has its own live leaderboard, ranked only by community votes, so you can find the most-loved tools in your niche.`}
      />
    </>
  );
}
