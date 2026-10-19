import HomePage from '@/components/HomePage';
import JsonLd from '@/components/JsonLd';
import { getRankedListings } from '@/lib/server/listings';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, itemListSchema, pageMetadata } from '@/lib/seo';

// Served from cache and rebuilt at most once a minute (keeps function CPU low).
export const revalidate = 60;

export const metadata = {
  ...pageMetadata({ title: `${SITE_NAME}: ${SITE_TAGLINE}`, description: SITE_DESCRIPTION, path: '/' }),
  // The homepage title is the full brand line, not "... | RankBid".
  title: { absolute: `${SITE_NAME}: ${SITE_TAGLINE}` },
};

export default async function Page() {
  // Rendered into the HTML so search engines and AI crawlers see the live rankings.
  const listings = (await getRankedListings()).slice(0, 1000).map(l => ({ ...l, isPremium: false }));
  return (
    <>
      <JsonLd data={itemListSchema('Top products on RankBid by community votes', listings.slice(0, 15))} />
      <HomePage initialListings={listings} />
    </>
  );
}
