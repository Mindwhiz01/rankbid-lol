import Link from 'next/link';
import type { ReactNode } from 'react';

/** The navy backdrop and white card used by the sign-in pages. */
export default function AuthShell({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#0B2545] via-[#0F3460] to-[#1a5490] text-gray-900 flex items-center justify-center px-4 py-10">
      <div className="absolute -top-32 -right-24 w-96 h-96 bg-[#1a5490] rounded-full blur-3xl opacity-40 pointer-events-none" aria-hidden="true" />
      <div className="absolute -bottom-32 -left-24 w-96 h-96 bg-[#059669] rounded-full blur-3xl opacity-25 pointer-events-none" aria-hidden="true" />
      <div className="relative w-full max-w-md slide-up">
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 md:p-10 border border-white/20">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex mb-4">
              <img src="/brand/logo.png" alt="RankBid" width={491} height={295} className="h-24 w-auto" />
            </Link>
            <p className="text-gray-600 text-sm mt-4">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export const authInput =
  'w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F3460] focus:border-transparent transition-all';
export const authButton =
  'w-full px-4 py-3 bg-[#0F3460] text-white font-bold rounded-lg hover:bg-[#0D2A50] disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
