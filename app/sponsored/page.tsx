'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import PageHero from '@/components/PageHero';
import SponsoredRow, { type SponsoredListing } from '@/components/SponsoredRow';
import { HOME_SPONSORED, MIN_BID_USD } from '@/lib/premiumSpots';
import { isSponsoredPreview, SPONSORED_PREVIEW } from '@/lib/sponsoredPreview';
import Pagination from '@/components/Pagination';
import { usePaged } from '@/lib/usePaged';

type Ranked = SponsoredListing & { premiumPosition?: number | null; premiumActivatedAt?: string | null };

/**
 * Every live sponsored listing, ranked by price. The homepage shows only the top HOME_SPONSORED.
 * /sponsored?today=1 (the homepage's "Today's ranking" card) shows only the spots bought since midnight.
 */
export default function SponsoredPage() {
  const [listings, setListings] = useState<Ranked[] | null>(null);
  const [todayOnly, setTodayOnly] = useState(false);

  useEffect(() => {
    setTodayOnly(new URLSearchParams(window.location.search).get('today') === '1');
  }, []);

  useEffect(() => {
    if (isSponsoredPreview()) {
      setListings(SPONSORED_PREVIEW);
      return;
    }
    fetch('/api/listings/submit?page=1&pageSize=1', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => setListings(data?.premium || []))
      .catch(() => setListings([]));
  }, []);

  const ranked = (listings || []).slice().sort((a, b) => (a.premiumPosition || 0) - (b.premiumPosition || 0));
  const home = ranked.slice(0, HOME_SPONSORED);
  const rest = ranked.slice(HOME_SPONSORED);
  const paged = usePaged(rest);

  // Ranked by price already, so today's spots keep that order (each row still shows its overall rank).
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = ranked.filter(l => l.premiumActivatedAt && new Date(l.premiumActivatedAt) >= startOfToday);
  const pagedToday = usePaged(today);

  const tab = (active: boolean) =>
    `px-4 py-2 rounded-xl text-sm font-black transition-colors ${active ? 'bg-[#0F3460] text-white' : 'bg-white border border-gray-200 text-[#1F2937]/70 hover:text-[#0F3460]'}`;

  return (
    <>
      <Header />
      <div className="bg-white text-[#1F2937]">
        <PageHero
          title={todayOnly ? "Today's Sponsors" : 'Sponsored Products'}
          subtitle={todayOnly
            ? 'Products sponsored since midnight, ranked by price. The number on each row is its rank among all sponsored products.'
            : `Ranked by price: whoever pays more sits higher. The top ${HOME_SPONSORED} also appear on the homepage. Sponsorship starts at $${MIN_BID_USD}: pay once and it stays for life.`}
        />

        <section className="bg-gray-50 py-6 sm:py-10 md:py-12 min-h-[40vh]">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 space-y-8">
            <div className="flex gap-2">
              <Link href="/sponsored?today=1" onClick={() => setTodayOnly(true)} className={tab(todayOnly)}>Today</Link>
              <Link href="/sponsored" onClick={() => setTodayOnly(false)} className={tab(!todayOnly)}>All sponsored</Link>
            </div>

            {listings === null ? (
              <div className="space-y-2.5">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="h-20 rounded-2xl bg-white border border-gray-100 animate-pulse" />
                ))}
              </div>
            ) : todayOnly ? (
              today.length === 0 ? (
                <div className="text-center py-12 bg-white border border-gray-200 rounded-2xl">
                  <p className="text-lg font-black text-[#1F2937]">No new sponsors yet today</p>
                  <p className="text-sm text-[#1F2937]/60 mt-1">Be the first today: sponsor your product from ${MIN_BID_USD}.</p>
                </div>
              ) : (
                <div id={pagedToday.anchorId} className="scroll-mt-24">
                  <h2 className="text-base sm:text-lg font-black text-[#1F2937] mb-3">
                    Sponsored today <span className="text-xs font-bold text-[#1F2937]/40">{today.length}</span>
                  </h2>
                  <div className="space-y-2 sm:space-y-2.5">
                    {pagedToday.pageItems.map(l => <SponsoredRow key={l.id} listing={l} />)}
                  </div>
                  <Pagination currentPage={pagedToday.page} totalPages={pagedToday.totalPages} onPageChange={pagedToday.goTo} />
                </div>
              )
            ) : ranked.length === 0 ? (
              <div className="text-center py-12 bg-white border border-gray-200 rounded-2xl">
                <p className="text-lg font-black text-[#1F2937]">No sponsored products yet</p>
                <p className="text-sm text-[#1F2937]/60 mt-1">Be the first: sponsor your product from ${MIN_BID_USD} and take #1.</p>
              </div>
            ) : (
              <>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-[#1F2937] mb-3">
                    On the homepage <span className="text-xs font-bold text-[#1F2937]/40">#1–#{Math.min(HOME_SPONSORED, home.length)}</span>
                  </h2>
                  <div className="space-y-2 sm:space-y-2.5">
                    {home.map(l => <SponsoredRow key={l.id} listing={l} />)}
                  </div>
                </div>

                {rest.length > 0 && (
                  <div id={paged.anchorId} className="scroll-mt-24">
                    <h2 className="text-base sm:text-lg font-black text-[#1F2937] mb-3">
                      More sponsored <span className="text-xs font-bold text-[#1F2937]/40">#{HOME_SPONSORED + 1}–#{ranked.length}</span>
                    </h2>
                    <div className="space-y-2 sm:space-y-2.5">
                      {paged.pageItems.map(l => <SponsoredRow key={l.id} listing={l} />)}
                    </div>
                    <Pagination currentPage={paged.page} totalPages={paged.totalPages} onPageChange={paged.goTo} />
                  </div>
                )}
              </>
            )}

            <div className="rounded-2xl bg-gradient-to-br from-[#0B2545] via-[#0F3460] to-[#1a5490] text-white p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <p className="text-lg sm:text-xl font-black">Want your product here?</p>
                <p className="text-sm text-white/70 mt-1">Pick your price: the amount decides your rank. Pay more than the listing above you to pass it.</p>
              </div>
              <Link href="/profile" className="inline-flex items-center justify-center px-5 py-2.5 bg-white text-[#0F3460] font-black text-sm rounded-xl shadow-lg hover:-translate-y-0.5 transition-all whitespace-nowrap">
                Sponsor a product
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
