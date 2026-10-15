'use client';

import { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import PageHero from '@/components/PageHero';
import { SUPPORT_EMAIL } from '@/lib/site';

type StorageItem = { name: string; type: 'Cookie' | 'Local storage'; purpose: string; duration: string };

const ESSENTIAL: StorageItem[] = [
  { name: 'auth_token', type: 'Cookie', purpose: 'Keeps you signed in to your account.', duration: '30 days' },
  { name: 'adminKey', type: 'Cookie', purpose: 'Grants site administrators access. Not set for regular visitors.', duration: '30 days' },
  { name: 'rankbid_voter_id', type: 'Local storage', purpose: 'Remembers which products this browser has voted for, to prevent duplicate votes.', duration: 'Until cleared' },
  { name: 'user', type: 'Local storage', purpose: 'Caches your basic profile so pages load signed-in.', duration: 'Until you sign out' },
];

const PREFERENCES: StorageItem[] = [
  { name: 'rankbid_voted_listings', type: 'Local storage', purpose: 'Remembers which products you voted for, so their buttons show “Voted”.', duration: 'Until cleared' },
  { name: 'rankbid_clicked', type: 'Local storage', purpose: 'Remembers which products you opened in the last 30 minutes, so click counts on screen match what is counted.', duration: '30 minutes' },
  { name: 'sessionId', type: 'Local storage', purpose: 'Anonymous visit ID used to count live visitors and page views.', duration: 'Until cleared' },
];

const PREFERENCE_KEYS = PREFERENCES.map(p => p.name);

function StorageTable({ items }: { items: StorageItem[] }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-left text-xs sm:text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-[0.12em] text-[#1F2937]/45">
            <th className="font-bold px-1 pb-2">Name</th>
            <th className="font-bold px-1 pb-2">Type</th>
            <th className="font-bold px-1 pb-2">Purpose</th>
            <th className="font-bold px-1 pb-2 whitespace-nowrap">Duration</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.name} className="border-t border-gray-100 align-top">
              <td className="px-1 py-2.5 font-mono text-[11px] sm:text-xs text-[#0F3460] font-semibold whitespace-nowrap">{item.name}</td>
              <td className="px-1 py-2.5 whitespace-nowrap text-[#1F2937]/70">{item.type}</td>
              <td className="px-1 py-2.5 text-[#1F2937]/75 min-w-[180px]">{item.purpose}</td>
              <td className="px-1 py-2.5 whitespace-nowrap text-[#1F2937]/70">{item.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CookiesPage() {
  const [cleared, setCleared] = useState(false);

  function clearPreferences() {
    try {
      PREFERENCE_KEYS.forEach(key => localStorage.removeItem(key));
    } catch {
      // Storage blocked: there is nothing stored to clear.
    }
    setCleared(true);
  }

  return (
    <>
      <Header />
      <div className="bg-gray-50 min-h-screen">
        <PageHero title="Cookie Policy & Settings" subtitle="Last updated: October 2026" />

        <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-10 md:py-12 space-y-3 sm:space-y-4">
          <section className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-black text-[#1F2937] mb-2">The short version</h2>
            <p className="text-xs sm:text-sm text-[#1F2937]/75 leading-relaxed">
              RankBid uses only what it needs to work: a sign-in cookie and a few browser storage entries. We don&rsquo;t use
              advertising cookies, tracking pixels or third-party analytics cookies, so there is nothing to opt out of.
              If you sign in with Google, Google may set its own cookies under its{' '}
              <a href="https://policies.google.com/technologies/cookies" target="_blank" rel="noopener noreferrer" className="text-[#0F3460] font-semibold hover:underline">cookie policy</a>.
            </p>
          </section>

          <section className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base sm:text-lg font-black text-[#1F2937]">Essential</h2>
                <p className="text-xs sm:text-sm text-[#1F2937]/60 mt-0.5">Required for sign-in, voting and security. These can&rsquo;t be turned off.</p>
              </div>
              <span className="flex-shrink-0 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#059669]/10 text-[#059669]">Always on</span>
            </div>
            <StorageTable items={ESSENTIAL} />
          </section>

          <section className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base sm:text-lg font-black text-[#1F2937]">Preferences</h2>
                <p className="text-xs sm:text-sm text-[#1F2937]/60 mt-0.5">Saved only when you change a setting. Clearing them resets the site to defaults.</p>
              </div>
              <button
                type="button"
                onClick={clearPreferences}
                disabled={cleared}
                className="flex-shrink-0 self-start text-xs font-bold px-4 py-2 rounded-lg bg-[#0F3460] text-white hover:bg-[#1a5490] disabled:bg-[#059669] disabled:cursor-default transition-colors"
              >
                {cleared ? 'Preferences cleared' : 'Clear saved preferences'}
              </button>
            </div>
            <StorageTable items={PREFERENCES} />
          </section>

          <section className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-black text-[#1F2937] mb-2">Removing everything</h2>
            <p className="text-xs sm:text-sm text-[#1F2937]/75 leading-relaxed">
              You can delete all RankBid cookies and storage in your browser&rsquo;s site settings. You&rsquo;ll be signed out,
              and the site will behave as if it&rsquo;s your first visit.
            </p>
          </section>

          <section className="bg-gradient-to-r from-[#0F3460] to-[#1a5490] rounded-xl p-4 sm:p-6 text-white">
            <h2 className="text-base sm:text-lg font-black mb-1">Questions?</h2>
            <p className="text-xs sm:text-sm text-white/80">
              Email us at <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-white underline underline-offset-2">{SUPPORT_EMAIL}</a>. See also our <Link href="/privacy" className="font-bold text-white underline underline-offset-2">Privacy Policy</Link>.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
