import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Trending Products: Last 24 Hours',
  description: 'Trending products on RankBid in the last 24 hours, ranked by today’s community votes and updated in real time.',
  path: '/today',
});

export default function TodayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
