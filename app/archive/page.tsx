'use client';

import Link from 'next/link';
import Header from '@/components/Header';
import PageHero from '@/components/PageHero';
import ArchiveCta from '@/components/ArchiveCta';
import { useState, useEffect } from 'react';
import { logoUrl } from '@/lib/logo';

interface SnapshotListing {
  rank: number;
  listing: {
    id: string;
    title: string;
    url: string;
  };
  votes: number;
}

interface DailySnapshot {
  id: string;
  date: string;
  data: SnapshotListing[];
  frozen: boolean;
}

// The archive starts with RankBid's first rankings (September 2026); there is nothing to show before it.
const ARCHIVE_START = new Date(2026, 8, 1);

/** Days from ARCHIVE_START to today, so every saved day back to the start is loaded. */
const daysSinceStart = () => Math.ceil((Date.now() - ARCHIVE_START.getTime()) / 86_400_000) + 1;

export default function ArchivePage() {
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  useEffect(() => {
    fetchArchives();
  }, []);

  const fetchArchives = async () => {
    try {
      const res = await fetch(`/api/daily-snapshots?daysBack=${daysSinceStart()}`);
      if (res.ok) {
        const data = await res.json();
        const fetchedSnapshots = data.snapshots || [];
        setSnapshots(fetchedSnapshots);
      }
    } catch (error) {
      console.error('Error fetching archives:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | Date) => {
    let date: Date;
    if (typeof dateStr === 'string') {
      if (dateStr.includes('T')) {
        date = new Date(dateStr);
      } else {
        date = new Date(dateStr + 'T00:00:00Z');
      }
    } else {
      date = new Date(dateStr);
    }

    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  };

  const getSnapshotsForMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();

    return snapshots.filter(s => {
      const snapshotDate = new Date(s.date + 'T00:00:00Z');
      return snapshotDate.getUTCFullYear() === year && snapshotDate.getUTCMonth() === month;
    }).sort((a, b) => {
      return new Date(b.date + 'T00:00:00Z').getTime() - new Date(a.date + 'T00:00:00Z').getTime();
    });
  };

  const monthSnapshots = getSnapshotsForMonth(selectedMonth);
  const now = new Date();
  const isCurrentMonth = selectedMonth.getFullYear() === now.getFullYear() && selectedMonth.getMonth() === now.getMonth();
  const isFirstMonth = selectedMonth.getFullYear() === ARCHIVE_START.getFullYear() && selectedMonth.getMonth() === ARCHIVE_START.getMonth();
  const shiftMonth = (delta: number) => {
    const d = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + delta, 1);
    setSelectedMonth(d);
  };
  const navBtn = 'inline-flex items-center gap-1 px-3 sm:px-4 py-2 bg-white border border-gray-200 text-[#1F2937] text-xs sm:text-sm font-bold rounded-lg hover:border-[#0F3460]/40 hover:text-[#0F3460] active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none';

  return (
    <>
      <Header />
      <div className="bg-white text-[#1F2937]">
        {/* Header Section */}
        <PageHero title="Rankings Archive" subtitle="Every day's top products, saved forever." />

        {/* Content Section */}
        <section className="bg-gray-50 py-6 sm:py-10 md:py-12 min-h-[40vh]">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6">
            {/* Month Navigation */}
            <div className="flex items-center justify-between gap-2 mb-5 sm:mb-8 p-2 sm:p-3 bg-white border border-gray-200 shadow-sm rounded-xl">
              <button onClick={() => shiftMonth(-1)} disabled={isFirstMonth} className={navBtn} aria-label="Previous month">
                ← <span className="hidden sm:inline">Previous</span>
              </button>
              <h2 className="text-base sm:text-xl font-black text-[#1F2937] text-center">
                {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <button onClick={() => shiftMonth(1)} disabled={isCurrentMonth} className={navBtn} aria-label="Next month">
                <span className="hidden sm:inline">Next</span> →
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin text-3xl sm:text-4xl">⏳</div>
                <p className="text-xs sm:text-sm text-[#1F2937]/70 font-semibold mt-2">Loading archives...</p>
              </div>
            ) : monthSnapshots.length === 0 ? (
              <div className="text-center py-8 sm:py-12 px-4 border border-gray-200 shadow-sm bg-white rounded-lg">
                <p className="text-sm font-bold text-[#1F2937]">No rankings saved for {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-6">
                {monthSnapshots.map((snapshot) => (
                  <div key={snapshot.id} className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
                    {/* Date Header */}
                    <div className="bg-gradient-to-r from-[#0F3460] to-[#1a5490] text-white px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
                      <h3 className="text-sm sm:text-lg font-black">
                        {formatDate(snapshot.date)}
                      </h3>
                      <p className="text-[11px] sm:text-xs font-semibold text-white/70 bg-white/10 px-2 py-1 rounded-full flex-shrink-0">
                        {snapshot.data?.length || 0} ranked
                      </p>
                    </div>

                    {/* Rankings List */}
                    <div className="bg-white">
                      {!snapshot.data || snapshot.data.length === 0 ? (
                        <div className="p-6 text-center text-xs sm:text-sm text-[#1F2937]/70">
                          <p>No submissions for this date</p>
                        </div>
                      ) : (
                        <div className="space-y-2 p-2.5 sm:p-4">
                          {snapshot.data.map((item) => {
                            let faviconUrl = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
                            try {
                              const urlObj = new URL(item.listing.url);
                              faviconUrl = logoUrl(urlObj.hostname, 32);
                            } catch {
                              // If URL parsing fails, use placeholder
                            }

                            return (
                              <Link
                                key={item.listing.id}
                                href={`/product/${item.listing.id}`}
                                className="flex items-center justify-between p-2.5 sm:p-3 bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-[#0F3460]/30 transition-all duration-200 group cursor-pointer gap-4 rounded-lg"
                              >
                                {/* Left: Rank Badge and Title */}
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className={`w-8 h-8 ${item.rank === 1 ? 'bg-gradient-to-br from-amber-400 to-amber-500' : item.rank === 2 ? 'bg-gradient-to-br from-slate-300 to-slate-400' : item.rank === 3 ? 'bg-gradient-to-br from-orange-300 to-orange-500' : 'bg-[#0F3460]'} text-white font-black text-xs rounded-lg flex items-center justify-center flex-shrink-0`}>
                                    #{item.rank}
                                  </div>
                                  <img src={faviconUrl} alt="favicon" loading="lazy" decoding="async" className="w-5 h-5 rounded flex-shrink-0" onError={(e) => { e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>'; }} />
                                  <p className="text-xs font-semibold text-[#1F2937] truncate group-hover:text-[#0F3460] transition-colors flex-1 min-w-0">
                                    {item.listing.title}
                                  </p>
                                </div>

                                {/* Right: Votes */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <p className="text-xs sm:text-sm font-black text-[#0F3460] min-w-[2rem] text-right whitespace-nowrap">
                                    {item.votes} <span className="font-semibold text-[#1F2937]/70">{item.votes === 1 ? 'vote' : 'votes'}</span>
                                  </p>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <ArchiveCta />
      </div>
    </>
  );
}
