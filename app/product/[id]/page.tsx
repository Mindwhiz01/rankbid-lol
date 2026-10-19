import type { Metadata } from 'next';
import ProductView from '@/components/ProductView';
import JsonLd from '@/components/JsonLd';
import { getListingById, getRankedListings } from '@/lib/server/listings';
import { getActiveHolders } from '@/lib/server/premium';
import { categoryPath, getCategoryLabel } from '@/lib/categories';
import { absoluteUrl, breadcrumbSchema, pageMetadata } from '@/lib/seo';

// Served from cache and rebuilt at most once a minute (keeps function CPU low).
export const revalidate = 60;

// No product is built ahead of time; each one is rendered on its first visit, then cached (ISR).
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await getListingById(id);
  if (!product) {
    return pageMetadata({ title: 'Product not found', description: 'This product is not listed on RankBid.', path: `/product/${id}`, noindex: true });
  }

  const category = getCategoryLabel(product.category);
  // Cut at a word boundary and drop trailing punctuation so the sentence never ends in ".." or half a word.
  const short = product.description.length > 110 ? product.description.slice(0, 110).replace(/\s+\S*$/, '') : product.description;
  const summary = short ? `${short.trim().replace(/[\s.,;:!?-]+$/, '')}. ` : '';
  return pageMetadata({
    title: `${product.title}: ${category} ranking & votes`,
    description: `${summary}${product.title} has ${product.totalVotes} community votes on RankBid. See its live rank in ${category} and vote for free.`,
    path: `/product/${product.id}`,
  });
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const [product, allListings, holders] = await Promise.all([getListingById(id), getRankedListings(), getActiveHolders(60)]);
  // A sponsored product shows the founder links saved with its payment.
  const spot = holders.find(h => h.listingId === id);
  // Only the public fields: the founder's email and phone must never reach the page.
  const founder = spot
    ? {
        premiumPosition: spot.position,
        founderName: spot.founderName,
        founderWebsite: spot.founderWebsite,
        founderTwitter: spot.founderTwitter,
        founderLinkedin: spot.founderLinkedin,
        founderInstagram: spot.founderInstagram,
        founderFacebook: spot.founderFacebook,
        founderTiktok: spot.founderTiktok,
        founderYoutube: spot.founderYoutube,
        founderGithub: spot.founderGithub,
      }
    : null;

  return (
    <>
      {product && (
        <JsonLd
          data={[
            breadcrumbSchema([
              { name: 'Categories', path: '/categories' },
              { name: getCategoryLabel(product.category), path: categoryPath(product.category) },
              { name: product.title, path: `/product/${product.id}` },
            ]),
            {
              '@type': 'WebPage',
              '@id': absoluteUrl(`/product/${product.id}`),
              name: product.title,
              description: product.description || undefined,
              datePublished: product.createdAt,
              dateModified: product.updatedAt,
              isPartOf: { '@id': absoluteUrl('/#website') },
              about: {
                '@type': 'Thing',
                name: product.title,
                ...(product.description && { description: product.description }),
                ...(product.imageUrl && /^https?:\/\//.test(product.imageUrl) && { image: product.imageUrl }),
                // A website is the thing's own URL; a social profile identifies the creator behind it.
                ...(/^https?:\/\//.test(product.url) && (product.platform === 'website' ? { url: product.url } : { sameAs: product.url })),
              },
              // Community votes, so answer engines can quote the live count.
              interactionStatistic: {
                '@type': 'InteractionCounter',
                interactionType: 'https://schema.org/VoteAction',
                userInteractionCount: product.totalVotes,
              },
            },
          ]}
        />
      )}
      <ProductView key={id} id={id} initialProduct={product} initialAllListings={allListings} founder={founder} />
    </>
  );
}
