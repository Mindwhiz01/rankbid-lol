'use client';

import Header from '@/components/Header';
import RankingRow from '@/components/RankingRow';
import { useState, useEffect } from 'react';
import SelectionHeading from '@/components/SelectionHeading';
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
  createdAt?: string;
  updatedAt?: string;
}


// Server-rendered with the current rankings (see page.tsx) so crawlers see them; refreshed live on mount.
export default function LeaderboardView({ initialListings }: { initialListings: Listing[] }) {
  const [listings, setListings] = useState<Listing[]>(initialListings);
  const [loading, setLoading] = useState(initialListings.length === 0);
  const [activeTab, setActiveTab] = useState<'alltime' | 'today'>('alltime');

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      const res = await fetch('/api/listings/submit?limit=500');
      if (!res.ok) {
        setListings([]);
        return;
      }
      const data = await res.json();
      setListings(data.listings || []);
    } catch (error) {
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  // Ranked by community votes (the old totalPaid/dayPaid bidding fields no longer exist).
  const votesFor = (l: Listing) => (activeTab === 'today' ? l.dayVotes : l.totalVotes) || 0;
  const lastVotedAt = (l: Listing) => new Date(l.updatedAt || l.createdAt || 0).getTime();
  const sortedListings = [...listings]
    .filter(l => activeTab === 'alltime' || (l.dayVotes || 0) > 0)
    // On equal votes, whoever reached that count most recently comes first.
    .sort((a, b) => votesFor(b) - votesFor(a) || lastVotedAt(b) - lastVotedAt(a));

  const topThree = sortedListings.slice(0, 3);
  const paged = usePaged(sortedListings, activeTab);

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="spotlight relative overflow-hidden bg-gradient-to-br from-[#0B2545] via-[#0F3460] to-[#1a5490] text-white">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute -top-24 -right-16 w-72 h-72 bg-[#1a5490] rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -left-16 w-72 h-72 bg-[#059669] rounded-full blur-3xl"></div>
          </div>
          <div className="relative max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-10 sm:py-14 md:py-20">
            <SelectionHeading
              as="h1"
              tone="dark"
              lead="global"
              highlight="leaderboard"
              sub="Top-ranked products, voted by the community."
            />
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-10 md:py-12">
          {/* Tabs */}
          <div className="inline-flex p-1 mb-6 sm:mb-10 bg-white border border-gray-200 shadow-sm rounded-full">
            <button
              onClick={() => setActiveTab('alltime')}
              className={`px-4 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-full transition-all ${
                activeTab === 'alltime'
                  ? 'bg-[#0F3460] text-white shadow-sm'
                  : 'text-[#1F2937]/70 hover:text-[#0F3460]'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setActiveTab('today')}
              className={`px-4 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-full transition-all ${
                activeTab === 'today'
                  ? 'bg-[#0F3460] text-white shadow-sm'
                  : 'text-[#1F2937]/70 hover:text-[#0F3460]'
              }`}
            >
              Today
            </button>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F3460]"></div>
            </div>
          ) : (
            <>
              {/* Top 3 Podium */}
              {topThree.length > 0 && (
                <div className="mb-10 sm:mb-16">
                  <h2 className="text-xl sm:text-2xl font-black text-[#1F2937] mb-4 sm:mb-8">🏆 Top 3</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6 md:items-end">
                    {/* 2nd Place */}
                    {topThree[1] && (
                      <div className="order-2 md:order-none">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 text-center hover:shadow-md transition-shadow">
                          <div className="text-4xl sm:text-5xl mb-2 sm:mb-3">🥈</div>
                          <h3 className="text-sm sm:text-base font-bold text-[#1F2937] mb-1 truncate">{topThree[1].title}</h3>
                          <p className="text-xs text-[#1F2937]/60 mb-3 sm:mb-4">{topThree[1].category}</p>
                          <p className="text-2xl sm:text-3xl font-black text-[#0F3460]">{votesFor(topThree[1])}</p>
                          <p className="text-xs text-[#1F2937]/60 font-semibold">votes</p>
                        </div>
                      </div>
                    )}

                    {/* 1st Place */}
                    {topThree[0] && (
                      <div>
                        <div className="bg-gradient-to-br from-[#0F3460] to-[#1a5490] rounded-xl border-2 border-[#0F3460]/30 p-5 sm:p-8 text-center text-white shadow-lg md:-translate-y-4">
                          <div className="text-5xl sm:text-6xl mb-2 sm:mb-3">🥇</div>
                          <h3 className="text-base sm:text-lg font-black mb-1 truncate">{topThree[0].title}</h3>
                          <p className="text-xs text-white/70 mb-3 sm:mb-4">{topThree[0].category}</p>
                          <p className="text-3xl sm:text-4xl font-black">{votesFor(topThree[0])}</p>
                          <p className="text-xs text-white/70 font-semibold">votes · #1 Ranked</p>
                        </div>
                      </div>
                    )}

                    {/* 3rd Place */}
                    {topThree[2] && (
                      <div className="order-2 md:order-none">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 text-center hover:shadow-md transition-shadow">
                          <div className="text-4xl sm:text-5xl mb-2 sm:mb-3">🥉</div>
                          <h3 className="text-sm sm:text-base font-bold text-[#1F2937] mb-1 truncate">{topThree[2].title}</h3>
                          <p className="text-xs text-[#1F2937]/60 mb-3 sm:mb-4">{topThree[2].category}</p>
                          <p className="text-2xl sm:text-3xl font-black text-[#0F3460]">{votesFor(topThree[2])}</p>
                          <p className="text-xs text-[#1F2937]/60 font-semibold">votes</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Full Rankings */}
              <div id={paged.anchorId} className="scroll-mt-24">
                <h2 className="text-xl sm:text-2xl font-black text-[#1F2937] mb-4 sm:mb-6">
                  {activeTab === 'today' ? 'Today' : 'All Time'} Rankings
                </h2>
                {sortedListings.length === 0 ? (
                  <div className="text-center py-8 sm:py-12 bg-white border border-gray-200 shadow-sm rounded-lg">
                    <p className="text-sm text-[#1F2937]/60 font-semibold">{activeTab === 'today' ? 'No votes yet today' : 'No products ranked yet'}</p>
                  </div>
                ) : (
                  <>
                    <div className="curve-list space-y-3">
                      {paged.pageItems.map((listing, idx) => (
                        <RankingRow key={listing.id} listing={listing} rank={paged.offset + idx + 1} votes={votesFor(listing) || 0} votesLabel={activeTab === 'today' ? 'today' : 'votes'} />
                      ))}
                    </div>
                    <Pagination currentPage={paged.page} totalPages={paged.totalPages} onPageChange={paged.goTo} />
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
