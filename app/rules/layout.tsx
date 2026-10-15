import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Rules & Guidelines',
  description: 'RankBid rules for listings and voting: one vote per person per product, no bots or vote trading, banned content, sponsored spots and how daily rankings work.',
  path: '/rules',
});

export default function RulesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
