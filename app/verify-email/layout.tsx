import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Confirm Your Email',
  description: 'Confirm the email address for your RankBid account.',
  path: '/verify-email',
  noindex: true,
});

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
