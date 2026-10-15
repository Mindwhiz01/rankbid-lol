'use client';

import Header from '@/components/Header';
import PageHero from '@/components/PageHero';
import RankingRow from '@/components/RankingRow';
import Pagination from '@/components/Pagination';
import PlatformsCta from '@/components/PlatformsCta';
import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { EmptyStateIcon } from '@/components/PremiumIcons';
import { openSubmitModal } from '@/components/SubmitProductModal';
import { normalizePlatform } from '@/lib/platform-url';

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
  imageUrl?: string;
  userVoted?: boolean;
}

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: '/instagram.png', color: '#E4405F', description: 'Instagram profiles & creators' },
  { id: 'linkedin', label: 'LinkedIn', icon: '/linkedin.png', color: '#0A66C2', description: 'LinkedIn profiles & companies' },
  { id: 'twitter', label: 'X / Twitter', icon: '/twitter.png', color: '#000000', description: 'Twitter/X profiles & accounts' },
  { id: 'facebook', label: 'Facebook', icon: '/facebook.png', color: '#1877F2', description: 'Facebook pages & profiles' },
  { id: 'tiktok', label: 'TikTok', icon: '/tiktok.png', color: '#000000', description: 'TikTok creators & accounts' },
  { id: 'website', label: 'Websites', icon: '/web.png', color: '#0F3460', description: 'Web products & services' },
];


export default function PlatformsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('instagram');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  // Per-platform listing counts for the selector, kept separate from the paged list below.
  const [platformCounts, setPlatformCounts] = useState<Record<string, number>>({});

  const fetchAllListingsForCounts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append('limit', '1000');
      params.append('offset', '0');

      const res = await fetch(`/api/listings?${params.toString()}`);
      if (!res.ok) return;

      const allListings: { platform?: string }[] = (await res.json()) || [];
      const counts: Record<string, number> = {};
      for (const l of allListings) {
        const key = l.platform === 'x' ? 'twitter' : (l.platform || 'website');
        counts[key] = (counts[key] || 0) + 1;
      }
      setPlatformCounts(counts);
    } catch (error) {
      console.error('Failed to fetch all listings for counts:', error);
    }
  }, []);

  const fetchListings = useCallback(async (page: number = 1) => {
    setLoading(true);
    try {
      const platformFilter = selectedPlatform === 'twitter' ? ['twitter', 'x'] : [selectedPlatform];
      const params = new URLSearchParams();
      params.append('sort', 'totalVotes');
      params.append('page', page.toString());
      params.append('pageSize', '20');
      platformFilter.forEach(p => params.append('platform', p));

      const res = await fetch(`/api/listings/submit?${params.toString()}`);
      if (!res.ok) {
        setListings([]);
        return;
      }

      const text = await res.text();
      if (!text) {
        setListings([]);
        return;
      }

      const data = JSON.parse(text);
      setListings(data.listings || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setCurrentPage(page);
    } catch (error) {
      console.error('Failed to fetch listings:', error);
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [selectedPlatform]);

  // Always start the newly selected platform from page 1.
  useEffect(() => {
    fetchListings(1);
  }, [fetchListings]);

  useEffect(() => {
    fetchAllListingsForCounts();
  }, [fetchAllListingsForCounts]);

  const selectedPlatformInfo = PLATFORMS.find(p => p.id === selectedPlatform);

  return (
    <>
      <Header />
      <div className="bg-white text-[#1F2937]">
        {/* HERO + PLATFORM PICKER */}
        <PageHero
          title="Social Platforms"
          subtitle="Top-ranked creators, profiles and products on every major platform. Pick one to see who’s leading."
        >
          <div className="slide-up mt-5 sm:mt-8 grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3" style={{ '--d': '240ms' } as CSSProperties}>
            {PLATFORMS.map(platform => {
              const active = selectedPlatform === platform.id;
              return (
                <button
                  key={platform.id}
                  onClick={() => setSelectedPlatform(platform.id)}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-1.5 p-2.5 sm:p-3 rounded-xl border transition-all duration-150 active:scale-95 ${
                    active
                      ? 'bg-white text-[#0F3460] border-white shadow-lg shadow-black/20'
                      : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
                  }`}
                >
                  <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-white flex items-center justify-center">
                    <img src={platform.icon} alt="" className="w-5 h-5 sm:w-6 sm:h-6 object-contain" />
                  </span>
                  <span className="text-[11px] sm:text-xs font-black">{platform.label}</span>
                  <span className={`text-[10px] sm:text-[11px] font-semibold ${active ? 'text-[#1F2937]/55' : 'text-white/60'}`}>
                    {platformCounts[platform.id] || 0} listed
                  </span>
                </button>
              );
            })}
          </div>
        </PageHero>

        {/* LISTINGS */}
        <section className="bg-gray-50 py-6 sm:py-10 md:py-12">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6">
            {selectedPlatformInfo && (
              <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 border border-gray-200 bg-white shadow-sm">
                  <img src={selectedPlatformInfo.icon} alt="" className="w-6 h-6 sm:w-7 sm:h-7 object-contain" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-2xl font-black text-[#1F2937]">Top on {selectedPlatformInfo.label}</h2>
                  <p className="text-xs sm:text-sm text-[#1F2937]/60">{selectedPlatformInfo.description}</p>
                </div>
              </div>
            )}
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin text-4xl">⏳</div>
                <p className="text-[#1F2937]/60 font-semibold mt-2">Loading listings...</p>
              </div>
            ) : listings.length === 0 ? (
              <div className="text-center py-8 sm:py-12 px-4 border border-gray-200 shadow-sm bg-white rounded-lg">
                <div className="mb-4"><EmptyStateIcon /></div>
                <p className="text-base sm:text-lg font-black text-[#1F2937] mb-1">No listings yet</p>
                <p className="text-xs sm:text-sm text-[#1F2937]/60 mb-4 sm:mb-6">Be the first to submit a {selectedPlatformInfo?.label.toLowerCase()}!</p>
                <button
                  onClick={() => openSubmitModal({ platform: normalizePlatform(selectedPlatform) })}
                  className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-[#0F3460] text-white font-black text-xs sm:text-sm rounded-lg hover:bg-[#0D2A50] active:scale-95 transition-all shadow-lg"
                >
                  Start Submitting
                </button>
              </div>
            ) : (
              <div className="curve-list space-y-3 sm:space-y-4">
                {listings.map((listing, idx) => (
                  <RankingRow key={listing.id} listing={listing} rank={(currentPage - 1) * 20 + idx + 1} votes={listing.totalVotes || 0} />
                ))}
              </div>
            )}

            {listings.length > 0 && totalPages > 1 && (
              <div className="mt-8">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(page) => {
                    fetchListings(page);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </div>
            )}
          </div>
        </section>

        <PlatformsCta />
      </div>
    </>
  );
}
