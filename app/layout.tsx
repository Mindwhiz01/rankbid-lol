import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

export const dynamic = 'force-dynamic';
import { Providers } from '@/components/Providers';
import Footer from '@/components/Footer';
import { VisitorTracker } from '@/components/visitor-tracker';
import InteractionEffects from '@/components/InteractionEffects';
import JsonLd from '@/components/JsonLd';
import ScrollToTop from '@/components/ScrollToTop';
import ScrollButtons from '@/components/ScrollButtons';
import { SubmitModalHost } from '@/components/SubmitProductModal';
import { SITE_URL, X_HANDLE } from '@/lib/site';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, organizationSchema, websiteSchema } from '@/lib/seo';

// One typeface for the whole site (body and headings), exposed as --font-inter for globals.css.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME}: ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${SITE_NAME}: ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    site: `@${X_HANDLE}`,
    title: `${SITE_NAME}: ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  verification: {
    google: '4u0doH_kugyrRATClwIvUKSma-VzuponDehpctakbvw',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} bg-white text-gray-900 flex flex-col min-h-screen`}>
        <JsonLd data={[organizationSchema, websiteSchema]} />
        <VisitorTracker />
        <InteractionEffects />
        <Providers>
          <ScrollToTop />
          <main className="flex-1">{children}</main>
          <Footer />
          <ScrollButtons />
          <SubmitModalHost />
        </Providers>
      </body>
    </html>
  );
}
