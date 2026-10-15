import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Sponsor Your Product',
  description: 'Sponsor your product on RankBid: choose your price, add your details and pay securely with Stripe.',
  path: '/sponsor',
  noindex: true,
});

export default function SponsorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
