import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <Header />
      <div className="bg-gray-50 min-h-[70vh] px-3 sm:px-4 py-10 sm:py-16">
        <div className="max-w-lg mx-auto slide-up">
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 sm:p-8 text-center">
            <p className="text-5xl font-black text-[#0F3460] mb-3">404</p>
            <h1 className="text-2xl sm:text-3xl font-black text-[#1F2937] mb-2">Page not found</h1>
            <p className="text-sm sm:text-base text-[#1F2937]/70 mb-6">
              This page doesn&apos;t exist or was moved. Try the live rankings or search for a product.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
              <Link href="/" className="px-5 py-2.5 bg-[#0F3460] text-white font-black text-sm rounded-lg hover:bg-[#0D2A50] active:scale-95 transition-all">
                Go to rankings
              </Link>
              <Link href="/search" className="px-5 py-2.5 bg-white text-[#0F3460] border border-gray-200 font-black text-sm rounded-lg hover:border-[#0F3460]/40 active:scale-95 transition-all">
                Search products
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
