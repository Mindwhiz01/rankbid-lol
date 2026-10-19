import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Launched Today: New Products',
  description: 'Products launched on RankBid today, ranked by community votes. Only today’s new submissions.',
  path: '/daily',
});

export default function DailyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
