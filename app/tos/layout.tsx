import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Terms of Service',
  description: 'The terms that govern using RankBid to submit products, vote and buy optional sponsored spots.',
  path: '/tos',
});

export default function TosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
