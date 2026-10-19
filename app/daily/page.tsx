import JsonLd from '@/components/JsonLd';
import { getLaunchedToday } from '@/lib/server/listings';
import { breadcrumbSchema, itemListSchema } from '@/lib/seo';
import DailyView from './DailyView';

// Served from cache and rebuilt at most once a minute (keeps function CPU low).
export const revalidate = 60;

export default async function DailyPage() {
  const listings = await getLaunchedToday(50);
  return (
    <>
      <JsonLd data={[itemListSchema('Products launched on RankBid today', listings), breadcrumbSchema([{ name: 'Daily launches', path: '/daily' }])]} />
      <DailyView initialListings={listings} />
    </>
  );
}
