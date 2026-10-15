import JsonLd from '@/components/JsonLd';
import { getRankedListings } from '@/lib/server/listings';
import { breadcrumbSchema, itemListSchema } from '@/lib/seo';
import LeaderboardView from './LeaderboardView';

export default async function LeaderboardPage() {
  const listings = (await getRankedListings()).slice(0, 500);
  return (
    <>
      <JsonLd data={[itemListSchema('RankBid all-time product leaderboard', listings.slice(0, 50)), breadcrumbSchema([{ name: 'Leaderboard', path: '/leaderboard' }])]} />
      <LeaderboardView initialListings={listings} />
    </>
  );
}
