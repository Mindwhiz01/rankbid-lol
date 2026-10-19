import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Forgot Password',
  description: 'Reset the password for your RankBid account.',
  path: '/forgot-password',
  noindex: true,
});

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
