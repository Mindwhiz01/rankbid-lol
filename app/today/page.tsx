import JsonLd from '@/components/JsonLd';
import { getTrendingToday } from '@/lib/server/listings';
import { breadcrumbSchema, itemListSchema } from '@/lib/seo';
import TodayView from './TodayView';

export default async function TodayPage() {
  const listings = await getTrendingToday();
  return (
    <>
      <JsonLd data={[itemListSchema('Trending products on RankBid in the last 24 hours', listings.slice(0, 50)), breadcrumbSchema([{ name: 'Today', path: '/today' }])]} />
      <TodayView initialListings={listings} />
    </>
  );
}
