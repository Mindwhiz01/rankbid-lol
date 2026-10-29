import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Confirm Your Vote',
  description: 'Confirm your RankBid support vote.',
  path: '/support/confirm',
  noindex: true,
});

export default function ConfirmSupportVoteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
