'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import PageHero from '@/components/PageHero';
import RankingRow from '@/components/RankingRow';
import { PremiumIcons } from '@/components/PremiumIcons';
import Pagination from '@/components/Pagination';
import { usePaged } from '@/lib/usePaged';

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
  createdAt: string;
}


// Server-rendered with today's board (see page.tsx) so crawlers see it; refreshed live every 30s.
export default function TodayView({ initialListings }: { initialListings: Listing[] }) {
  const [listings, setListings] = useState<Listing[]>(initialListings);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const res = await fetch('/api/listings/submit?sort=dayVotes&activeToday=1&limit=100');

        if (!res.ok) {
          console.error('API error:', res.status);
          setListings([]);
          return;
        }

        const text = await res.text();
        if (!text) {
          console.error('Empty response from API');
          setListings([]);
          return;
        }

        const data = JSON.parse(text);
        setListings(data.listings || []);
      } catch (error) {
        console.error('Failed to fetch listings:', error);
        setListings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchListings();
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const topListingsToday = listings
    .filter(l => l.dayVotes > 0)
    .sort((a, b) => b.dayVotes - a.dayVotes)
    .slice(0, 50);
  const paged = usePaged(topListingsToday);

  return (
    <>
      <Header />
      <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <PageHero title="Today’s Hot Rankings" subtitle="The last 24 hours of community votes. See what’s trending right now.">
        <div className="slide-up mt-5 sm:mt-7 flex flex-wrap gap-2 sm:gap-3" style={{ '--d': '240ms' } as CSSProperties}>
          <div className="flex items-center gap-2.5 sm:gap-3 bg-white/10 border border-white/15 backdrop-blur-sm rounded-xl px-3 sm:px-4 py-2 sm:py-2.5">
            <PremiumIcons.Layers className="w-5 h-5 text-white/80" />
            <div>
              <p className="text-base sm:text-xl font-black leading-tight">{topListingsToday.length}</p>
              <p className="text-[11px] sm:text-xs text-white/65 font-semibold">Products today</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 sm:gap-3 bg-white/10 border border-white/15 backdrop-blur-sm rounded-xl px-3 sm:px-4 py-2 sm:py-2.5">
            <PremiumIcons.Ballot className="w-5 h-5 text-emerald-300" />
            <div>
              <p className="text-base sm:text-xl font-black leading-tight">{topListingsToday.reduce((sum, l) => sum + l.dayVotes, 0)}</p>
              <p className="text-[11px] sm:text-xs text-white/65 font-semibold">Votes today</p>
            </div>
          </div>
        </div>
      </PageHero>

      {/* Leaderboard */}
      <section className="bg-gray-50 py-6 sm:py-10 md:py-12 min-h-[40vh]">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6">
          {loading ? (
            <div className="text-center py-8 sm:py-12">
              <div className="inline-block animate-spin text-3xl sm:text-4xl">⏳</div>
              <p className="text-xs sm:text-sm text-[#1F2937]/60 font-semibold mt-2 sm:mt-3">Loading today&apos;s rankings...</p>
            </div>
          ) : topListingsToday.length === 0 ? (
            <div className="bg-white border border-gray-200 shadow-sm rounded-2xl text-center py-8 sm:py-12 px-4 sm:px-8">
              <div className="text-3xl sm:text-4xl mb-3">🌅</div>
              <p className="text-base sm:text-lg font-black text-[#1F2937] mb-2">No votes yet today</p>
              <p className="text-xs sm:text-sm text-[#1F2937]/70 mb-4 sm:mb-6">Be the first: submit a product or vote for one you love.</p>
              <Link
                href="/#submit"
                className="inline-flex items-center justify-center px-4 sm:px-6 py-2 sm:py-3 bg-[#0F3460] text-white font-black text-xs sm:text-sm rounded-lg hover:bg-[#0D2A50] active:scale-95 transition-all"
              >
                Submit Your Product
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

      {/* How It Works */}
      <section className="bg-white py-8 sm:py-12 md:py-14 border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-[#1F2937] mb-6 sm:mb-8 md:mb-10 text-center">
            How <span className="text-[#0F3460]">Today&apos;s</span> Rankings Work
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-8 max-w-5xl mx-auto">
            {[
              {
                icon: <PremiumIcons.Calendar />,
                title: 'Rolling 24h Window',
                desc: 'Every vote cast in the last 24 hours counts toward your today rank. Older votes roll off automatically.'
              },
              {
                icon: <PremiumIcons.Pulse />,
                title: 'Real-Time Updates',
                desc: 'Rankings refresh every 30 seconds. Watch the competition heat up as the community votes throughout the day.'
              },
              {
                icon: <PremiumIcons.Rocket />,
                title: 'Quick Traffic Spike',
                desc: 'Perfect for launching a product or testing a marketing campaign. Get discovered by active makers searching today.'
              },
              {
                icon: <PremiumIcons.Trophy />,
                title: 'Historical Archives',
                desc: 'Every day, the top products are saved to the Archive so past winners stay visible forever.'
              }
            ].map((item, idx) => (
              <div key={idx} className="flex gap-3.5 sm:gap-4">
                <span className="w-10 h-10 rounded-xl bg-[#0F3460]/5 text-[#0F3460] flex items-center justify-center flex-shrink-0">{item.icon}</span>
                <div className="flex-grow">
                  <h3 className="text-sm sm:text-base font-black text-[#1F2937] mb-0.5">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-[#1F2937]/70 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      </div>
    </>
  );
}
