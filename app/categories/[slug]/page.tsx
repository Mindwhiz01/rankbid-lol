import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import CategoryBrowser from '@/components/CategoryBrowser';
import JsonLd from '@/components/JsonLd';
import { categoryFromSlug, categoryPath, categorySlug, getCategoryLabel } from '@/lib/categories';
import { getCategoryListings, getRankedListings } from '@/lib/server/listings';
import { getCustomCategories } from '@/lib/server/custom-categories';
import { breadcrumbSchema, itemListSchema, pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ slug: string }> };

const intro = (label: string) =>
  `The best ${label} products on RankBid, ranked live by community votes. Each person gets one vote per product, so the ${label} leaderboard reflects what real users recommend, not who paid the most.`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = categoryFromSlug(slug, await getCustomCategories());
  if (!category) return {};
  const label = getCategoryLabel(category);
  return pageMetadata({
    title: `Best ${label} Products, Ranked by Votes`,
    description: `Discover the top ${label} products, tools and creators, ranked by real community votes on RankBid. Updated live. Submit your ${label} product for free.`,
    path: categoryPath(category),
  });
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const custom = await getCustomCategories();
  const category = categoryFromSlug(slug, custom);
  if (!category) notFound();
  // Old links used the stored value ("AIMedia"); send them to the canonical slug.
  if (slug !== categorySlug(category)) permanentRedirect(categoryPath(category));

  const label = getCategoryLabel(category);
  const [listings, all] = await Promise.all([getCategoryListings(category), getRankedListings()]);
  const counts: Record<string, number> = {};
  for (const l of all) counts[l.category] = (counts[l.category] || 0) + 1;

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Categories', path: '/categories' },
            { name: label, path: categoryPath(category) },
          ]),
          itemListSchema(`Top ${label} products on RankBid`, listings),
        ]}
      />
      <CategoryBrowser selected={category} listings={listings} counts={counts} intro={intro(label)} custom={custom} />
    </>
  );
}
