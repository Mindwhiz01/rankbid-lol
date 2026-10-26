'use client';

import Link from 'next/link';
import Header from '@/components/Header';
import PageHero from '@/components/PageHero';
import RankingRow from '@/components/RankingRow';
import Pagination from '@/components/Pagination';
import { useLiveRefresh } from '@/lib/useLiveRefresh';
import { usePaged } from '@/lib/usePaged';
import { useState, useEffect, type CSSProperties } from 'react';

interface Listing {
  id: string;
  url: string;
  title: string;
  description: string;
  category: string;
  platform: string;
  totalVotes: number;
  dayVotes: number;
  clickCount: number;
}

interface CountdownTime {
  hours: number;
  minutes: number;
  seconds: number;
}


/** Today's top 50 by today's votes, or null when the request fails. */
async function fetchTodayRankings(): Promise<Listing[] | null> {
  try {
    const res = await fetch('/api/listings/submit?sort=dayVotes&limit=100&timeFilter=today&fresh=1', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.listings || []).sort((a: Listing, b: Listing) => b.dayVotes - a.dayVotes).slice(0, 50);
  } catch {
    return null;
  }
}

// Server-rendered with today's launches (see page.tsx) so crawlers see them; refreshed live.
export default function DailyView({ initialListings }: { initialListings: Listing[] }) {
  const [listings, setListings] = useState<Listing[]>(initialListings);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState<CountdownTime>({ hours: 0, minutes: 0, seconds: 0 });
  const paged = usePaged(listings);

  // Today's rankings, freshly read; a failed read keeps the last known ones.
  const refresh = () => fetchTodayRankings().then(rows => {
    if (rows) setListings(rows);
    setLoading(false);
  });

  useEffect(() => {
    let live = true;
    fetchTodayRankings().then(rows => {
      if (!live) return;
      if (rows) setListings(rows);
      setLoading(false);
    });

    const calculateCountdown = () => {
      // Time until the next UTC midnight (timestamps are already UTC; no timezone shifting needed).
      const now = new Date();
      const nextUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
      const diff = nextUtcMidnight - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown({ hours, minutes, seconds });

      // Refresh listings when countdown reaches 0 (day changed)
      if (diff <= 0) {
        fetchTodayRankings().then(rows => { if (live && rows) setListings(rows); });
      }
    };

    // First tick right away (in a callback, not the effect body), then every second.
    const first = setTimeout(calculateCountdown, 0);
    const timer = setInterval(calculateCountdown, 1000);

    return () => {
      live = false;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  useLiveRefresh(refresh);

  return (
    <>
      <Header />
      <div className="bg-white text-[#1F2937]">
        {/* Header Section */}
        <PageHero title="Launched today" subtitle="Only products submitted today (UTC), ranked by community votes. Everything trending? See Trending now.">
          <div className="slide-up mt-5 sm:mt-7 inline-flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white/10 border border-white/15 rounded-xl backdrop-blur-sm" style={{ '--d': '240ms' } as CSSProperties}>
            <span className="text-xs sm:text-sm font-bold text-white/80">Resets in</span>
            <div className="flex gap-1.5 sm:gap-2 items-center">
              <div className="flex flex-col items-center bg-white text-[#0F3460] min-w-[3rem] sm:min-w-[3.5rem] px-2 py-1.5 rounded-lg shadow-sm">
                <span className="text-lg sm:text-2xl font-black tabular-nums leading-none">{String(countdown.hours).padStart(2, '0')}</span>
                <span className="text-[10px] font-bold text-[#1F2937]/70 mt-0.5">Hours</span>
              </div>
              <span className="text-lg sm:text-2xl font-black text-white/60">:</span>
              <div className="flex flex-col items-center bg-white text-[#0F3460] min-w-[3rem] sm:min-w-[3.5rem] px-2 py-1.5 rounded-lg shadow-sm">
                <span className="text-lg sm:text-2xl font-black tabular-nums leading-none">{String(countdown.minutes).padStart(2, '0')}</span>
                <span className="text-[10px] font-bold text-[#1F2937]/70 mt-0.5">Mins</span>
              </div>
              <span className="text-lg sm:text-2xl font-black text-white/60">:</span>
              <div className="flex flex-col items-center bg-white text-[#0F3460] min-w-[3rem] sm:min-w-[3.5rem] px-2 py-1.5 rounded-lg shadow-sm">
                <span className="text-lg sm:text-2xl font-black tabular-nums leading-none">{String(countdown.seconds).padStart(2, '0')}</span>
                <span className="text-[10px] font-bold text-[#1F2937]/70 mt-0.5">Secs</span>
              </div>
            </div>
          </div>
        </PageHero>

        {/* Listings Section */}
        <section className="bg-gray-50 py-6 sm:py-10 md:py-12 min-h-[40vh]">
          <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin text-4xl">⏳</div>
                <p className="text-[#1F2937]/70 font-semibold mt-2">Loading rankings...</p>
              </div>
            ) : listings.length === 0 ? (
              <div className="text-center py-8 sm:py-12 px-4 border border-gray-200 shadow-sm bg-white rounded-lg">
                <p className="text-sm sm:text-base font-bold text-[#1F2937] mb-1">Nothing launched yet today</p>
                <p className="text-xs sm:text-sm text-[#1F2937]/70 mb-4">Launch yours now and get a head start on today’s board.</p>
                <Link
                  href="/#submit"
                  className="inline-flex px-4 sm:px-6 py-2 sm:py-2.5 bg-[#0F3460] text-white font-black text-xs sm:text-sm rounded-lg hover:bg-[#0D2A50] active:scale-95 transition-all"
                >
                  Submit a Listing
                </Link>
              </div>
            ) : (
              <>
                <div id={paged.anchorId} className="curve-list space-y-3 scroll-mt-24">
                  {paged.pageItems.map((listing, idx) => (
                    <RankingRow key={listing.id} listing={listing} rank={paged.offset + idx + 1} votes={listing.dayVotes || 0} votesLabel="today" />
                  ))}
                </div>
                <Pagination currentPage={paged.page} totalPages={paged.totalPages} onPageChange={paged.goTo} />
              </>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
