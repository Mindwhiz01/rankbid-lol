import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Choose a New Password',
  description: 'Set a new password for your RankBid account.',
  path: '/reset-password',
  noindex: true,
});

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
