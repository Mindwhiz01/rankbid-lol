import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Sponsored Products',
  description: 'Every sponsored product on RankBid, ranked by price. The top 10 also appear on the homepage.',
  path: '/sponsored',
});

export default function SponsoredLayout({ children }: { children: React.ReactNode }) {
  return children;
}
