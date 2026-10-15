'use client';

import Header from '@/components/Header';
import FAQ from '@/components/FAQ';
import Link from 'next/link';
import { FAQS } from '@/lib/faqs';
import Pagination from '@/components/Pagination';
import PlatformIcon from '@/components/PlatformIcon';
import SponsoredRow from '@/components/SponsoredRow';
import VerifiedListingCard from '@/components/VerifiedListingCard';
import { useRouter } from 'next/navigation';
import LoginModal from '@/components/LoginModal';
import StatusCardModal from '@/components/StatusCardModal';
import { EmptyStateIcon, IconTile, PremiumIcons } from '@/components/PremiumIcons';
import RankingRow from '@/components/RankingRow';
import SubmitProductForm, { type SubmittedProduct } from '@/components/SubmitProductForm';
import { openSubmitModal } from '@/components/SubmitProductModal';
import type { SubmitPlatform } from '@/lib/platform-url';
import LivePodium from '@/components/LivePodium';
import SelectionHeading from '@/components/SelectionHeading';
import RankingsSignpost from '@/components/RankingsSignpost';
import TrustedBy from '@/components/TrustedBy';
import HomeCta from '@/components/HomeCta';
import { getCategoryLabel as formatCategory } from '@/lib/categories';

// Stagger delay for the .slide-up entrance animation (see globals.css).
const slideDelay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

import { getPlatformIcon } from '@/lib/platformIcons';
import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { supportUrl } from '@/lib/site';
import { HOME_SPONSORED } from '@/lib/premiumSpots';
import { isSponsoredPreview, SPONSORED_PREVIEW } from '@/lib/sponsoredPreview';

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
  isPremium: boolean;
  premiumPosition?: number | null;
  premiumBidUsd?: number | null;
  founderName?: string | null;
  founderWebsite?: string | null;
  founderTwitter?: string | null;
  founderLinkedin?: string | null;
  founderInstagram?: string | null;
  founderFacebook?: string | null;
  founderTiktok?: string | null;
  founderYoutube?: string | null;
  founderGithub?: string | null;
  // Verified/Professional user info
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  userTier?: string | null;
  userPhone?: string | null;
  userWebsite?: string | null;
  userTwitter?: string | null;
  userLinkedin?: string | null;
  userInstagram?: string | null;
  userFacebook?: string | null;
  userTiktok?: string | null;
  userYoutube?: string | null;
  userGithub?: string | null;
}

// Shared CamelCase splitter with the known labels ("AIMedia" -> "AI").
const getCategoryLabel = formatCategory;

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

// SVG Icons Component
const Icons = {
  Globe: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20H7m6-4h.01M9 20h6" />
    </svg>
  ),
  Zap: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  Heart: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  Users: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-2a6 6 0 0112 0v2zm0 0h6v-2a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  Upload: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  ),
  Vote: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Trophy: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  Sparkles: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  TrendingUp: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  Check: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  Star: () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
  Tag: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
};

// Soft left edge for the why-makers photo, so it melts into the navy beside the copy.
const PHOTO_FADE = 'linear-gradient(to right, transparent, black 18%)';

// initialListings: the server-rendered first page (see app/page.tsx) so crawlers see the rankings
// without running JavaScript; the client refetches on mount and keeps it live.
export default function Home({ initialListings = [] }: { initialListings?: Listing[] }) {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string; name?: string } | null>(null);
  const [listings, setListings] = useState<Listing[]>(() => initialListings.slice(0, 15));
  const [premiumListings, setPremiumListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTimeFilter] = useState<'alltime' | 'today'>('alltime');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(() => Math.max(1, Math.ceil(initialListings.length / 15)));
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Listings the signed-in user submitted: only these get the Premium button (the checkout API enforces it too).
  const [ownListingIds, setOwnListingIds] = useState<Set<string>>(new Set());
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [shareCardOpen, setShareCardOpen] = useState(false);
  const [selectedListingForShare, setSelectedListingForShare] = useState<Listing | null>(null);
  const [allListings, setAllListings] = useState<Listing[]>(initialListings);

  const [submitPlatform, setSubmitPlatform] = useState<SubmitPlatform>('website');
  // /?category=AIMedia#submit (from an empty category page) preselects that category.
  const [initialSubmitCategory] = useState(() =>
    typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('category') ?? ''
  );
  const [votedListings, setVotedListings] = useState<Set<string>>(new Set());
  const [optimisticVotes, setOptimisticVotes] = useState<Record<string, number>>({});
  const [lastSubmittedProduct, setLastSubmittedProduct] = useState<{ id: string; title: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const loadOwnListingIds = async () => {
    try {
      const res = await fetch('/api/user/submissions');
      if (!res.ok) return; // signed out
      const data = await res.json();
      const own: { id: string; title: string }[] = (data.listings || []).map((l: { id: string; title: string }) => ({ id: l.id, title: l.title }));
      setOwnListingIds(new Set(own.map(l => l.id)));
    } catch {
      // No Premium buttons is the safe fallback.
    }
  };

  useEffect(() => {
    // Check if user is logged in
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('user');
      }
    }

    setCurrentPage(1);
    fetchListings(1);
    loadOwnListingIds();

    // Fetch all listings for rank calculation
    const fetchAllListings = async () => {
      try {
        const res = await fetch('/api/listings/submit?limit=1000&sort=totalVotes');
        if (res.ok) {
          const text = await res.text();
          if (text) {
            const data = JSON.parse(text);
            setAllListings(data.listings || []);
          }
        }
      } catch (error) {
        console.error('Failed to fetch all listings:', error);
      }
    };
    fetchAllListings();
  }, [activeTimeFilter, selectedCategory]);

  const handleVote = useCallback(async (listingId: string) => {
    if (!user) {
      setLoginModalOpen(true);
      return;
    }

    setVotedListings(prev => new Set([...prev, listingId]));
    setOptimisticVotes(prev => ({
      ...prev,
      [listingId]: (prev[listingId] || 0) + 1
    }));

    try {
      const res = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        addToast('Vote recorded! ✨', 'success');
        setTimeout(async () => {
          const sort = activeTimeFilter === 'today' ? 'dayVotes' : 'totalVotes';
          const categoryParam = selectedCategory === 'All' ? '' : `&category=${encodeURIComponent(selectedCategory)}`;
          const timeParam = activeTimeFilter === 'today' ? '&timeFilter=today' : '';
          const fetchRes = await fetch(`/api/listings/submit?sort=${sort}&page=1&pageSize=15${categoryParam}${timeParam}`);
          if (fetchRes.ok) {
            const text = await fetchRes.text();
            if (text) {
              const data = JSON.parse(text);
              setListings(data.listings || []);
              setTotalPages(data.pagination?.totalPages || 1);
              setCurrentPage(1);
              setOptimisticVotes({});
            }
          }
        }, 1500);
      } else if (data.error === 'Already voted') {
        setVotedListings(prev => {
          const newSet = new Set(prev);
          newSet.delete(listingId);
          return newSet;
        });
        setOptimisticVotes(prev => {
          const newVotes = {...prev};
          delete newVotes[listingId];
          return newVotes;
        });
        addToast('You already voted for this', 'error');
      }
    } catch (error) {
      setVotedListings(prev => {
        const newSet = new Set(prev);
        newSet.delete(listingId);
        return newSet;
      });
      addToast('Voting failed, please try again', 'error');
    }
  }, [activeTimeFilter, selectedCategory, user]);

  const fetchListings = useCallback(async (page: number = 1) => {
    setLoading(true);
    try {
      const sort = activeTimeFilter === 'today' ? 'dayVotes' : 'totalVotes';
      const categoryParam = selectedCategory === 'All' ? '' : `&category=${encodeURIComponent(selectedCategory)}`;
      const timeParam = activeTimeFilter === 'today' ? '&timeFilter=today' : '';
      const res = await fetch(`/api/listings/submit?sort=${sort}&page=${page}&pageSize=15${categoryParam}${timeParam}`);
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
      setPremiumListings(isSponsoredPreview() ? SPONSORED_PREVIEW : data.premium || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setCurrentPage(page);
    } catch (error) {
      setListings([]);
      addToast('Failed to load rankings', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTimeFilter, selectedCategory]);

  const calculateRank = (totalVotes: number): number => {
    return allListings.filter(l => (l.totalVotes || 0) > totalVotes).length + 1;
  };

  // A product went live through the submit form: celebrate it and refresh the rankings.
  const handleSubmitted = ({ id, displayHandle }: SubmittedProduct) => {
    const displayName = displayHandle ? `@${displayHandle}` : 'Your product';
    addToast(`🎉 ${displayName} is live! Community voting starts now.`, 'success');
    setLastSubmittedProduct({ id, title: displayName });
    setCurrentPage(1);
    fetchListings(1);
    loadOwnListingIds();
  };

  const handleShareTwitter = () => {
    if (!lastSubmittedProduct) return;
    const productUrl = supportUrl(lastSubmittedProduct.id);
    const text = `Just submitted ${lastSubmittedProduct.title} on RankBid! 🚀 Vote for my product and help it climb the global rankings. No algorithms, just pure community voting. #RankBid`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(productUrl)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
  };

  const handleShareLinkedIn = () => {
    if (!lastSubmittedProduct) return;
    const productUrl = supportUrl(lastSubmittedProduct.id);
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(productUrl)}`;
    window.open(linkedInUrl, '_blank', 'width=550,height=420');
  };

  const handleCopyLink = async () => {
    if (!lastSubmittedProduct) return;
    const productUrl = supportUrl(lastSubmittedProduct.id);
    try {
      await navigator.clipboard.writeText(productUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      addToast('Failed to copy link', 'error');
    }
  };

  // Sponsor checkout is its own page (/sponsor): from the Sponsored section the price aims for that rank.
  const openClaim = (position: number) => {
    if (!user) {
      setLoginModalOpen(true);
      return;
    }
    router.push(`/sponsor?rank=${position}`);
  };

  // Sponsored spots change whenever someone's payment lands: keep them fresh without a reload.
  useEffect(() => {
    if (isSponsoredPreview()) return;
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/api/listings/submit?page=1&pageSize=1', { cache: 'no-store' });
        if (res.ok) setPremiumListings((await res.json()).premium || []);
      } catch {
        // Keep showing the last known spots.
      }
    };
    const timer = setInterval(refresh, 15_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  // Sponsored listings are ranked by price (#1, #2, … with no gaps). The homepage shows the top 10;
  // #1-#3 always show (on the podium), then one open rank after the last listing (up to #10).
  const sponsoredCount = premiumListings.length;
  const visibleSpots = Math.min(HOME_SPONSORED, Math.max(3, sponsoredCount + 1));

  const totalVotes = allListings.reduce((n, l) => n + (l.totalVotes || 0), 0);

  return (
    <>
      <Header />
      <div className="bg-white text-[#1F2937]">

        {/* HERO: short centered copy + live top 3 podium */}
        <section className="relative overflow-hidden bg-[#FAFBFD] border-b border-gray-200">
          {/* Soft dotted backdrop */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.5] [background-image:radial-gradient(#0F3460_0.6px,transparent_0.6px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_top,#000_20%,transparent_70%)]"
          />

          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 md:pt-24 text-center">
            <a
              href="/leaderboard"
              style={slideDelay(0)}
              className="slide-up inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1F2937]/70 shadow-sm hover:border-gray-300 transition-colors"
            >
              <span className="relative flex w-2 h-2">
                <span className="absolute inset-0 rounded-full bg-[#059669] animate-ping opacity-60" />
                <span className="relative w-2 h-2 rounded-full bg-[#059669]" />
              </span>
              <span className="tabular-nums">{allListings.length ? `${allListings.length} products · ${totalVotes} votes` : 'Live rankings'}</span>
              <span className="text-[#1F2937]/40">→</span>
            </a>

            <h1 style={slideDelay(80)} className="slide-up mt-6 text-[2.6rem] leading-[1.02] sm:text-6xl md:text-7xl font-black tracking-[-0.04em] text-[#0B2545]">
              Ranked by people.{' '}
              <span className="block text-[#1F2937]/30">Not algorithms.</span>
            </h1>
            <p style={slideDelay(140)} className="slide-up mt-5 sm:mt-6 text-sm sm:text-base md:text-lg text-[#1F2937]/60 max-w-xl mx-auto">
              RankBid is a free product launch platform. Submit your product, collect community votes, and climb a live leaderboard ranked only by real people. Want the top of the page? Sponsored spots start at $1.
            </p>

          </div>

          {/* Live top 3 podium: refreshes on its own every few seconds */}
          <div style={slideDelay(200)} className="slide-up relative max-w-5xl mx-auto px-4 sm:px-6 mt-10 sm:mt-12 pb-14 sm:pb-20">
            <LivePodium onClaim={openClaim} />

            {/* SPONSORED #4-#10: the podium shows #1-#3; the rest are on /sponsored */}
            {visibleSpots > 3 && (
              <div className="mt-8 sm:mt-10">
                <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
                  <div className="flex items-center gap-2 text-amber-500">
                    <Icons.Star />
                    <h3 className="text-base sm:text-lg font-black text-[#1F2937]">More sponsored</h3>
                    <span className="text-xs font-bold text-[#1F2937]/40">ranked by price</span>
                  </div>
                  <a href="/sponsored" className="text-xs sm:text-sm font-black text-amber-700 hover:underline whitespace-nowrap">
                    {sponsoredCount > HOME_SPONSORED ? `See all ${sponsoredCount} →` : 'See all →'}
                  </a>
                </div>
                <div className="space-y-2 sm:space-y-2.5">
                  {Array.from({ length: visibleSpots - 3 }, (_, i) => i + 4).map(pos => {
                    const holder = premiumListings.find(l => l.premiumPosition === pos);
                    if (holder) return <SponsoredRow key={holder.id} listing={holder} />;
                    return (
                      <button
                        key={`open-${pos}`}
                        type="button"
                        onClick={() => openClaim(pos)}
                        aria-label={`Sponsor your product at #${pos}`}
                        className="group w-full text-left flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl border-2 border-dashed border-amber-200 bg-white/60 hover:border-amber-400 hover:bg-amber-50/60 transition-all"
                      >
                        <span className="w-7 sm:w-9 flex-shrink-0 text-sm sm:text-lg font-black text-amber-600/70 tabular-nums">#{pos}</span>
                        <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-amber-700 bg-amber-100 rounded-md px-2 py-0.5">Open</span>
                        <span className="flex-1 min-w-0 text-xs sm:text-sm font-semibold text-[#1F2937]/50 truncate">Feature your product here for 30 days</span>
                        <span className="flex-shrink-0 text-xs sm:text-sm font-black text-amber-700 group-hover:underline">Claim</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* FORM SECTION */}
        <section id="submit" className="scroll-mt-28 bg-gray-50 py-6 sm:py-10 md:py-12 border-b border-gray-200 fade-in">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6">
            {!user ? (
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0B2545] via-[#0F3460] to-[#1a5490] text-white p-5 sm:p-8 md:p-10 shadow-lg">
                <div className="absolute -top-20 -right-16 w-64 h-64 bg-[#059669]/25 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
                <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 items-center">
                  <div>
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-black mb-2 sm:mb-3">Launch your product in 2 minutes</h2>
                    <p className="text-xs sm:text-sm md:text-base text-white/75 mb-5 sm:mb-6">Create a free account to submit products and vote for your favourites.</p>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      <a
                        href="/signup"
                        className="inline-flex items-center justify-center px-5 sm:px-6 py-2.5 sm:py-3 bg-white text-[#0F3460] font-black text-sm rounded-xl shadow-lg hover:-translate-y-0.5 transition-all"
                      >
                        Create Free Account
                      </a>
                      <a
                        href="/login?next=%2F%23submit"
                        className="inline-flex items-center justify-center px-5 sm:px-6 py-2.5 sm:py-3 bg-white/10 border border-white/25 text-white font-black text-sm rounded-xl hover:bg-white/20 transition-all"
                      >
                        Sign In
                      </a>
                    </div>
                  </div>
                  <ol className="space-y-2.5 sm:space-y-3">
                    {[
                      { title: 'Paste your link', text: 'Website or social profile' },
                      { title: 'Pick a category', text: 'We auto-fill the details' },
                      { title: 'Collect votes', text: 'Climb the live rankings' },
                    ].map((step, i) => (
                      <li key={step.title} className="flex items-center gap-3 p-3 bg-white/10 border border-white/15 rounded-xl backdrop-blur-sm">
                        <span className="w-8 h-8 rounded-lg bg-white text-[#0F3460] font-black text-sm flex items-center justify-center flex-shrink-0">{i + 1}</span>
                        <div>
                          <p className="text-sm font-black">{step.title}</p>
                          <p className="text-xs text-white/65">{step.text}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-4 sm:p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4 sm:mb-6">
                  <IconTile><PremiumIcons.Rocket /></IconTile>
                  <div>
                    <h2 className="text-base sm:text-lg md:text-2xl font-black text-[#1F2937]">Submit Your Product</h2>
                    <p className="text-xs sm:text-sm text-[#1F2937]/60">Free, instant, and ranked by real votes.</p>
                  </div>
                </div>

            <SubmitProductForm
              platform={submitPlatform}
              onPlatformChange={setSubmitPlatform}
              initialCategory={initialSubmitCategory}
              onError={message => addToast(message, 'error')}
              onSubmitted={handleSubmitted}
            />

            {/* Share Buttons - Show after successful submission */}
            {lastSubmittedProduct && (
              <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-[#059669]/5 border border-[#059669]/25 rounded-xl fade-in">
                <h3 className="text-base sm:text-lg font-bold text-[#1F2937] mb-2 sm:mb-4">🎉 Your product is live!</h3>
                <p className="text-xs sm:text-sm text-[#1F2937]/70 mb-3 sm:mb-4">Share your support link: friends can vote with just their name and email, no account needed.</p>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <button
                    onClick={handleShareTwitter}
                    className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-bold text-xs sm:text-sm w-full sm:w-auto"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2s9 5 20 5a9.5 9.5 0 00-9-5.5c4.75 2.25 7-7 7-7" />
                    </svg>
                    <span>Share on X</span>
                  </button>

                  <button
                    onClick={handleShareLinkedIn}
                    className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-[#0A66C2] text-white rounded-lg hover:bg-[#004182] transition-colors font-bold text-xs sm:text-sm w-full sm:w-auto"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
                      <circle cx="4" cy="4" r="2" />
                    </svg>
                    <span>Share on LinkedIn</span>
                  </button>

                  <button
                    onClick={handleCopyLink}
                    className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-white text-[#0F3460] border border-[#0F3460]/30 rounded-lg hover:bg-[#0F3460]/5 transition-colors font-bold text-xs sm:text-sm w-full sm:w-auto"
                  >
                    {copied ? (
                      <>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
                <button
                  onClick={() => setLastSubmittedProduct(null)}
                  className="text-xs sm:text-sm text-[#1F2937]/60 hover:text-[#1F2937] font-semibold"
                >
                  Dismiss
                </button>
              </div>
            )}
              </div>
            )}
          </div>
        </section>

        {/* LEADERBOARD SECTION */}
        <section id="leaderboard" className="bg-white py-12 sm:py-16 md:py-20 border-b border-gray-200 fade-in">
          <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6">
            <div className="mb-10 sm:mb-12 flex items-center justify-between gap-3 sm:gap-6">
              <SelectionHeading
                lead="the top"
                highlight="rankings"
                sub="Every product, ordered by real community votes."
                className="min-w-0"
              />
              <RankingsSignpost className="shrink-0 w-32 min-[400px]:w-36 sm:w-48 md:w-64 lg:w-72 h-auto" />
            </div>

            {/* Category filter moved to header navigation */}

            {loading && listings.length === 0 ? (
              <div className="text-center py-8 sm:py-10 md:py-12">
                <div className="inline-block animate-spin text-3xl sm:text-4xl">⏳</div>
                <p className="text-xs sm:text-sm text-[#1F2937]/60 font-semibold mt-2 sm:mt-3">Loading rankings...</p>
              </div>
            ) : listings.length === 0 ? (
              <div className="text-center py-8 sm:py-10 md:py-12 border border-gray-200 shadow-sm bg-white fade-in rounded-lg">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-[#0F3460]/5 text-[#0F3460] flex items-center justify-center">
                  <Icons.Users />
                </div>
                <p className="text-xs sm:text-sm font-bold text-[#1F2937] mb-3 sm:mb-4 mt-3 sm:mt-4">No rankings yet</p>
                <button
                  onClick={() => openSubmitModal({ category: selectedCategory === 'All' ? null : selectedCategory })}
                  className="px-4 sm:px-6 py-2 sm:py-2.5 bg-[#0F3460] text-white font-black text-xs sm:text-sm hover:bg-[#0D2A50] active:scale-95 transition-all duration-200 rounded-lg"
                >
                  Be First to Submit
                </button>
              </div>
            ) : (
              <div className="curve-list space-y-2 sm:space-y-3">
                {listings.map((listing, idx) => {
                  // Check if this is a verified/professional user listing
                  if (listing.userTier === 'verified' || listing.userTier === 'professional') {
                    return (
                      <VerifiedListingCard
                        key={listing.id}
                        listing={{
                          id: listing.id,
                          title: listing.title,
                          url: listing.url,
                          totalVotes: listing.totalVotes,
                          dayVotes: listing.dayVotes,
                          category: listing.category,
                          platform: listing.platform,
                        }}
                        user={{
                          id: listing.userId || '',
                          name: listing.userName || null,
                          email: listing.userEmail || '',
                          tier: listing.userTier as 'verified' | 'professional',
                          phone: listing.userPhone || null,
                          website: listing.userWebsite || null,
                          twitter: listing.userTwitter || null,
                          linkedin: listing.userLinkedin || null,
                          instagram: listing.userInstagram || null,
                          facebook: listing.userFacebook || null,
                          tiktok: listing.userTiktok || null,
                          youtube: listing.userYoutube || null,
                          github: listing.userGithub || null,
                        }}
                        position={(currentPage - 1) * 15 + idx + 1}
                        onVote={handleVote}
                        hasVoted={votedListings.has(listing.id)}
                      />
                    );
                  }

                  // Regular listing row (shared with the other ranking pages)
                  return (
                    <RankingRow
                      key={listing.id}
                      listing={listing}
                      rank={(currentPage - 1) * 15 + idx + 1}
                      votes={(activeTimeFilter === 'today' ? listing.dayVotes : listing.totalVotes) || 0}
                      onPremium={listing.isPremium || !ownListingIds.has(listing.id) ? undefined : () => router.push(`/sponsor?listing=${encodeURIComponent(listing.id)}`)}
                    />
                  );
                })}
              </div>
            )}
            {listings.length > 0 && totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(page) => {
                  fetchListings(page);
                  document.getElementById('leaderboard')?.scrollIntoView({ behavior: 'smooth' });
                }}
              />
            )}
            {listings.length > 0 && (
              <div className="text-center mt-4 sm:mt-6">
                <a
                  href="/leaderboard"
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#0F3460] hover:underline underline-offset-2"
                >
                  View full leaderboard →
                </a>
              </div>
            )}
          </div>
        </section>

        {/* TOP RANKINGS BY SOCIAL PLATFORM */}
        <section className="bg-gray-50 py-8 sm:py-12 md:py-16 border-b border-gray-200 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-5 pointer-events-none">
            <div className="absolute top-0 left-10 w-40 sm:w-64 h-40 sm:h-64 bg-[#0F3460] rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 right-10 w-40 sm:w-64 h-40 sm:h-64 bg-[#059669] rounded-full blur-3xl"></div>
          </div>

          <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 relative z-10">
            {/* Section Header */}
            <SelectionHeading
              lead="top by"
              highlight="platform"
              sub="What's winning right now on Instagram, LinkedIn and X."
              className="mb-10 sm:mb-14"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
              {['instagram', 'linkedin', 'twitter'].map((platform) => {
                const platformLabel = platform === 'twitter' ? 'X' : platform.charAt(0).toUpperCase() + platform.slice(1);
                const platformColor = platform === 'instagram' ? '#E4405F' : platform === 'linkedin' ? '#0A66C2' : '#000000';

                // Use the full listing set (not just the current page) so each platform shows its real top 3.
                const platformListings = (allListings.length ? allListings : listings)
                  .filter(l => platform === 'twitter' ? ['twitter', 'x'].includes(l.platform) : l.platform === platform)
                  .sort((a, b) => (activeTimeFilter === 'today' ? b.dayVotes - a.dayVotes : b.totalVotes - a.totalVotes))
                  .slice(0, 3);

                return (
                  <div
                    key={platform}
                    className="bg-white border border-gray-200 shadow-sm p-4 sm:p-5 md:p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group rounded-2xl relative overflow-hidden flex flex-col"
                  >
                    {/* Brand-colored top accent */}
                    <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: platformColor }} aria-hidden="true" />
                    {/* Header */}
                    <div className="flex items-center justify-center gap-3 mb-4 sm:mb-5">
                      <div className="w-10 h-10 md:w-11 md:h-11 flex-shrink-0 rounded-xl flex items-center justify-center" style={{ backgroundColor: platformColor + '14' }}>
                        <PlatformIcon platform={platform} size={22} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm sm:text-base font-black text-[#1F2937]">{platformLabel}</p>
                        <p className="text-xs text-[#1F2937]/55">Top rated {activeTimeFilter === 'today' ? 'today' : 'all time'}</p>
                      </div>
                    </div>

                    {platformListings.length > 0 ? (
                      <div className="space-y-1.5 sm:space-y-2 md:space-y-3 flex-1">
                        {platformListings.map((item, idx) => {
                          const isTopThree = idx < 3;
                          const voteCount = activeTimeFilter === 'today' ? item.dayVotes : item.totalVotes;

                          return (
                            <a
                              key={item.id}
                              href={`/product/${item.id}`}
                              className={`flex items-center justify-between p-2 sm:p-2.5 md:p-3.5 rounded-xl transition-all duration-200 group/item cursor-pointer ${
                                isTopThree
                                  ? 'bg-gray-50 border border-gray-200 hover:bg-white hover:shadow-md hover:border-[#0F3460]/30'
                                  : 'bg-white/70 border border-gray-300/50 hover:bg-white hover:border-[#0F3460]/30'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 sm:gap-2.5 flex-1 min-w-0">
                                <div className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm font-black flex-shrink-0 ${
                                  isTopThree
                                    ? 'bg-gradient-to-br from-[#0F3460] to-[#0D2A50] text-white shadow-md'
                                    : 'bg-gray-200 text-[#1F2937]'
                                }`}>
                                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs sm:text-xs md:text-sm font-bold text-[#1F2937] truncate group-hover/item:text-[#0F3460]">{item.title}</p>
                                  {item.category && (
                                    <p className="text-xs text-[#1F2937]/50 mt-0.5 truncate">
                                      {getCategoryLabel(item.category)}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 sm:gap-1.5 ml-1 sm:ml-2 flex-shrink-0">
                                <span className={`text-xs md:text-sm font-black px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg ${
                                  isTopThree
                                    ? 'bg-[#0F3460]/10 text-[#0F3460]'
                                    : 'bg-gray-100 text-[#1F2937]'
                                }`}>
                                  {voteCount}
                                </span>
                                <Icons.Heart />
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-4 sm:py-6 md:py-8 flex-1 flex items-center justify-center">
                        <div>
                          <div className="mb-3 sm:mb-4"><EmptyStateIcon size="sm" /></div>
                          <p className="text-xs sm:text-xs md:text-sm text-[#1F2937]/60 font-semibold mb-2 sm:mb-3">No submissions yet</p>
                          <p className="text-xs text-[#1F2937]/50">Be the first to submit!</p>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => openSubmitModal({ platform: platform as SubmitPlatform })}
                      className={`w-full mt-3 sm:mt-4 md:mt-6 px-2 sm:px-3 py-2 sm:py-2.5 md:py-3 font-bold text-xs md:text-sm rounded-xl transition-all duration-200 active:scale-95 border-2 border-[#0F3460] text-[#0F3460] hover:bg-[#0F3460] hover:text-white shadow-sm hover:shadow-md`}
                    >
                      Submit for {platformLabel} →
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>


        {/* WHY MAKERS SECTION: navy gradient with a photo blended in on the right */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#0B2545] via-[#0F3460] to-[#1a5490] text-white">
          {/* Desktop only; phones and tablets get no photo. The photo fills from 40% across to the
              right edge, full height, so the phone and hand show beside the copy. The inner box
              covers that area at the photo's own aspect ratio (scaling up on wide screens instead
              of leaving a gap on the right), which keeps the notification on her sweater. */}
          <div className="absolute inset-y-0 left-[40%] right-0 hidden lg:block [container-type:size]" aria-hidden="true">
            <div
              className="absolute left-0 aspect-[2198/1396]"
              style={{
                width: 'max(100cqw, calc(100cqh * 2198 / 1396))',
                // Overflow is trimmed a quarter from the top, the rest from the bottom, so her face stays in view
                top: 'calc((100cqh - max(100cqh, 100cqw * 1396 / 2198)) * 0.25)',
              }}
            >
              <img
                src="/why-makers-person.jpg"
                alt=""
                className="h-full w-full"
                style={{ maskImage: PHOTO_FADE, WebkitMaskImage: PHOTO_FADE }}
              />
              {/* Frosted RankBid notification over her sweater: label + close button, then a card
                  with two fainter cards stacked beneath it */}
              <div className="absolute left-[34%] top-[51%] w-[31%]">
                <div className="flex items-center justify-between pl-3 pr-1">
                  <span className="text-sm font-medium text-white drop-shadow">Notification Center</span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs text-gray-500 shadow">✕</span>
                </div>
                <div className="relative mt-2.5">
                  <div className="absolute inset-x-[9%] -bottom-[22px] top-4 rounded-2xl bg-white/30 backdrop-blur-sm" />
                  <div className="absolute inset-x-[4%] -bottom-[11px] top-2 rounded-2xl bg-white/50 backdrop-blur-sm" />
                  <div className="relative flex items-center gap-3 rounded-2xl bg-white/85 p-3 shadow-xl backdrop-blur-md">
                    <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-[#0F3460]/10">
                      <img src="/brand/logo-mark.png" alt="" width={223} height={194} className="w-8 h-auto" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-bold text-[#0B2545]">RankBid</p>
                        <p className="text-[11px] text-gray-400">2 min ago</p>
                      </div>
                      <p className="mt-0.5 text-xs leading-snug text-gray-500">Your product just hit <span className="font-semibold text-[#059669]">#1 today</span> 🏆</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Desktop: copy sits near the left edge rather than in a centred column */}
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-14 sm:pb-20 lg:py-28 lg:max-w-none lg:mx-0 lg:pl-[clamp(2.5rem,6vw,8rem)] lg:pr-0">
            {/* Copy + four reasons, no cards */}
            <div className="lg:max-w-[560px]">
              <SelectionHeading
                lead="why makers"
                highlight="launch here"
                sub="A fair, free launchpad where the community, not an algorithm, decides what rises."
                tone="dark"
                className="mb-10 sm:mb-12"
              />
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-8">
                {[
                  { icon: <PremiumIcons.Gift />, title: 'Free to launch', text: 'Submit unlimited products with no listing fees.' },
                  { icon: <PremiumIcons.Scale />, title: 'Fair for everyone', text: 'Votes alone decide the leaderboard. Paid spots are always labeled Sponsored.' },
                  { icon: <PremiumIcons.Pulse />, title: 'Live feedback', text: 'Watch real votes and rankings update in real time.' },
                  { icon: <PremiumIcons.Share />, title: 'Built to share', text: 'Share your rank card on X and LinkedIn to rally votes.' },
                ].map(item => (
                  <li key={item.title} className="group flex gap-4">
                    <span className="w-11 h-11 flex-shrink-0 rounded-full bg-emerald-300/15 text-emerald-300 flex items-center justify-center transition-colors group-hover:bg-emerald-300 group-hover:text-[#0B2545]">
                      {item.icon}
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-white tracking-[-0.01em] mb-1">{item.title}</h3>
                      <p className="text-sm text-white/65 leading-relaxed">{item.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* TRUSTED BY MAKERS: illustration, live numbers, real reviews */}
        <TrustedBy
          products={allListings.length}
          votes={totalVotes}
          categories={new Set(allListings.map(l => l.category)).size}
        />

        {/* FAQ SECTION */}
        <section className="py-12 sm:py-16 md:py-24 bg-gray-50 border-t border-gray-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-10 lg:gap-16 items-start">
            {/* Heading styled like a text selection: highlight box with a handle at each end */}
            <div className="lg:sticky lg:top-32">
              <h2 className="text-[#0B2545] leading-[0.95] tracking-[-0.03em]">
                <span className="block text-5xl sm:text-6xl lg:text-7xl font-light">you have</span>
                <span className="relative inline-block mt-2 sm:mt-3 px-2 sm:px-3 py-1 bg-[#CDD0E3] text-5xl sm:text-6xl lg:text-7xl font-bold">
                  questions?
                  <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#3B4CCA]">
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#3B4CCA]" />
                  </span>
                  <span aria-hidden="true" className="absolute right-0 top-0 bottom-0 w-[3px] bg-[#3B4CCA]">
                    <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#3B4CCA]" />
                  </span>
                </span>
              </h2>
              <p className="mt-8 sm:mt-10 text-xl sm:text-2xl text-[#0B2545]">
                We’re <em className="font-bold">here</em> to help.
              </p>
            </div>

            <div className="border-t border-[#0B2545]/10">
              {FAQS.slice(0, 8).map((faq, idx) => (
                <FAQ key={idx} index={idx} question={faq.q} answer={faq.a} open={openFaq === idx} onToggle={() => setOpenFaq(openFaq === idx ? null : idx)} />
              ))}
              <Link href="/faq" className="inline-flex items-center gap-1.5 mt-6 px-4 sm:px-6 text-sm font-bold text-[#3B4CCA] hover:underline">
                See all RankBid FAQs →
              </Link>
            </div>
          </div>
        </section>

        {/* CLOSING CTA */}
        <HomeCta />
      </div>

      {/* LOGIN MODAL */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        title="Login Required to Submit"
      />

      {/* STATUS CARD MODAL */}
      {selectedListingForShare && (
        <StatusCardModal
          isOpen={shareCardOpen}
          onClose={() => {
            setShareCardOpen(false);
            setSelectedListingForShare(null);
          }}
          product={{
            id: selectedListingForShare.id,
            title: selectedListingForShare.title,
            description: selectedListingForShare.description,
            category: selectedListingForShare.category,
            platform: selectedListingForShare.platform,
            totalVotes: selectedListingForShare.totalVotes,
            rank: calculateRank(selectedListingForShare.totalVotes || 0),
          }}
          productUrl={supportUrl(selectedListingForShare.id)}
        />
      )}

      {/* TOAST NOTIFICATIONS */}
      <div className="fixed bottom-3 left-3 right-3 sm:bottom-4 md:bottom-6 md:right-6 md:left-auto z-50 space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-3 border-2 sm:border-2 md:border-3 border-gray-300 font-bold text-xs md:text-sm animate-in fade-in slide-in-from-bottom-2 flex items-center gap-2 rounded-lg ${
              toast.type === 'success'
                ? 'bg-[#86EFAC] text-[#1F2937]'
                : toast.type === 'error'
                ? 'bg-red-100 text-red-700 border-red-400'
                : 'bg-white text-[#1F2937]'
            }`}
            style={{boxShadow: 'none'}}
          >
            {toast.type === 'success' && <Icons.Check />}
            {toast.type === 'error' && <Icons.Zap />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </>
  );
}
