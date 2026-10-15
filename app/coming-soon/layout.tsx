import { SITE_DESCRIPTION, pageMetadata } from '@/lib/seo';

// Indexable: while coming soon mode is on, every gated URL redirects here, so this page is
// what search engines and AI answer engines read about RankBid. Keep the brand description.
export const metadata = pageMetadata({
  title: 'Launching soon',
  description: SITE_DESCRIPTION,
  path: '/coming-soon',
});

export default function ComingSoonLayout({ children }: { children: React.ReactNode }) {
  return children;
}
