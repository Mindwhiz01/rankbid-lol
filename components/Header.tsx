'use client';

import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { categoryPath } from '@/lib/categories';
import { setStoredUser, useHydrated, useStoredUser } from '@/lib/storedUser';
import { Search, Menu, X, Grid3x3, Trophy, Sparkles, LineChart, Users, Zap, Palette, Bitcoin, Code2, Compass, Activity, Eye, TrendingUp, LogOut } from 'lucide-react';

// Loaded when first opened (the header is on every page), so it isn't in every page's JavaScript.
const SearchDialog = dynamic(() => import('@/components/SearchDialog'), { ssr: false });

// `category` must match the stored listing category values (see CATEGORIES in app/page.tsx).
// Tabs without one link to their own page instead.
const CATEGORIES = [
  { name: 'All', Icon: Grid3x3, href: '/' },
  { name: 'Leaderboards', Icon: Trophy, href: '/leaderboard' },
  { name: 'AI', Icon: Sparkles, category: 'AIMedia' },
  { name: 'Marketing', Icon: LineChart, category: 'Marketing' },
  { name: 'Productivity', Icon: Zap, category: 'Productivity' },
  { name: 'Agents', Icon: Users, category: 'Agents' },
  { name: 'Crypto', Icon: Bitcoin, category: 'Crypto' },
  { name: 'Design', Icon: Palette, category: 'Design' },
  { name: 'Developer', Icon: Code2, category: 'Developer' },
  { name: 'Explore', Icon: Compass, href: '/categories' }
];

function CategoryBar() {
  const pathname = usePathname();

  return (
    <>
      {CATEGORIES.map((cat) => {
        const Icon = cat.Icon;
        const href = cat.category ? categoryPath(cat.category) : cat.href!;
        const isActive = pathname === href;

        return (
          <Link
            key={cat.name}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={`flex-shrink-0 px-3 md:px-4 py-2 min-h-[36px] text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 md:gap-2 rounded-lg transition-colors ${
              isActive
                ? 'bg-[#0F3460] text-white shadow-sm'
                : 'bg-white text-[#1F2937] shadow-xs hover:bg-[#0F3460]/10'
            }`}
            title={cat.name}
          >
            <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
            <span>{cat.name}</span>
          </Link>
        );
      })}
    </>
  );
}

export default function Header() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useStoredUser();
  // False until the browser has read the stored user, so signed-in users never see the auth buttons flash.
  const authChecked = useHydrated();
  // null until loaded: the server HTML shows dashes, not "0 visitors" (crawlers and AI engines read it on every page).
  const [stats, setStats] = useState<{ live: number; today: number; views: number } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  // ⌘K / Ctrl+K opens search from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The site is light-only; clear any dark class left from earlier visits.
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('theme');
  }, []);

  // Fetch stats for header display
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [liveRes, totalRes] = await Promise.all([
          fetch('/api/analytics/live-viewers'),
          fetch('/api/analytics/total-stats'),
        ]);

        if (!liveRes.ok || !totalRes.ok) {
          console.error('[Stats] API error:', { liveRes: liveRes.status, totalRes: totalRes.status });
          return;
        }

        const liveData = await liveRes.json();
        const totalData = await totalRes.json();

        setStats({
          live: liveData.liveViewers || 0,
          today: totalData.totalVisitors || 0,
          views: totalData.totalPageViews || 0,
        });
      } catch (error) {
        console.error('[Stats] Fetch error:', error);
      }
    };

    // Fetch immediately on mount
    fetchStats();

    // Then refresh once a minute while the tab is visible (the API is CDN-cached for 30s anyway).
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchStats();
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    // End the server session first; clearing localStorage alone leaves the auth cookie working.
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    localStorage.removeItem('auth_token');
    setStoredUser(null);
    router.push('/');
  };

  return (
    <>
      {/* Top Header - Professional Corporate */}
      <header className="bg-white text-[#1F2937] shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-2 sm:px-3 md:px-6">
          {/* Main Header */}
          <div className="flex items-center justify-between h-12 sm:h-14 md:h-16">
            {/* Logo & Hamburger (never shrinks: the logo must stay whole) */}
            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4 flex-shrink-0">
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
                className="lg:hidden p-2 -ml-1 text-[#1F2937] rounded-lg flex-shrink-0 hover:bg-gray-100"
              >
                {mobileOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" /> : <Menu className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />}
              </button>
              <Link href="/" className="flex items-center gap-2 flex-shrink-0">
                {/* The largest element in the first paint on phones: preloaded and served as a small WebP/AVIF. */}
                <Image src="/brand/logo-horizontal.png" alt="RankBid" width={823} height={194} preload sizes="160px" className="h-7 sm:h-8 md:h-9 w-auto" />
              </Link>
            </div>

            {/* Center Stats: hidden from 1024px to 1279px, where the desktop nav and the sign-in buttons need the room */}
            <div className="hidden md:flex lg:hidden xl:flex items-center gap-3 ml-4 lg:ml-6 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                <span className="text-xs font-semibold text-gray-900">{stats?.live ?? '–'}</span>
                <span className="text-xs text-gray-500">LIVE</span>
              </div>
              <span className="text-gray-300 text-xs">•</span>
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-semibold text-gray-900">{stats?.today ?? '–'}</span>
                <span className="text-xs text-gray-500">VISITORS</span>
              </div>
              <span className="text-gray-300 text-xs">•</span>
              <div className="flex items-center gap-1">
                <Eye className="w-4 h-4 text-gray-600" />
                <span className="text-xs font-semibold text-gray-900">{stats?.views ?? '–'}</span>
                <span className="text-xs text-gray-500">VIEWS</span>
              </div>
            </div>

            {/* Spacer */}
            <div className="flex-1"></div>

            {/* Desktop Nav - Right Side */}
            <nav className="hidden lg:flex items-center gap-1 md:gap-4 flex-shrink-0">
                <Link href="/platforms" className="text-xs md:text-sm font-medium text-[#1F2937] flex items-center gap-1 px-2 py-1">
                  <TrendingUp className="w-3 h-3 md:w-4 md:h-4" />
                  <span className="hidden xl:inline">Platforms</span>
                </Link>
                <Link href="/why" className="text-xs md:text-sm font-medium text-[#1F2937] px-2 py-1">
                  Why
                </Link>
                <Link href="/daily" className="text-xs md:text-sm font-medium text-[#1F2937] px-2 py-1">
                  Daily
                </Link>
                <Link href="/archive" className="text-xs md:text-sm font-medium text-[#1F2937] px-2 py-1">
                  Archive
                </Link>
                <Link href="/categories" className="text-xs md:text-sm font-medium text-[#1F2937] px-2 py-1">
                  Categories
                </Link>
                <Link href="/about" className="text-xs md:text-sm font-medium text-[#1F2937] px-2 py-1">
                  About
                </Link>
              </nav>

              {/* Profile Avatar */}
              {user ? (
                <Link
                  href="/profile"
                  className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 bg-gradient-to-br from-[#0F3460] to-[#1a5490] rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm ml-1 sm:ml-2 flex-shrink-0"
                  title={user.name || user.email}
                >
                  {(user.name || user.email).charAt(0).toUpperCase()}
                </Link>
              ) : authChecked ? (
                <div className="flex items-center gap-1 sm:gap-2 ml-1 sm:ml-2 flex-shrink-0">
                  <Link href="/login" className="hidden sm:inline-flex text-xs md:text-sm font-semibold text-[#0F3460] px-2 md:px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                    Log in
                  </Link>
                  <Link href="/signup" className="inline-flex items-center text-xs md:text-sm font-bold text-white bg-gradient-to-r from-[#0F3460] to-[#1a5490] px-2.5 sm:px-3 md:px-4 py-1.5 md:py-2 rounded-lg shadow-sm hover:shadow-md transition-shadow whitespace-nowrap">
                    Sign up
                  </Link>
                </div>
              ) : null}

              {/* Search */}
              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Search products"
                title="Search (⌘K)"
                className="p-1 sm:p-1.5 md:p-2 text-[#1F2937] rounded-lg flex-shrink-0 hover:bg-gray-100 transition-colors"
              >
                <Search className="w-4 h-4 md:w-5 md:h-5" />
              </button>
          </div>

          {/* Mobile Menu */}
          {mobileOpen && (
            <div className="lg:hidden py-2 sm:py-3 border-t border-gray-200 space-y-1.5 sm:space-y-2 pb-2 sm:pb-3">
              {/* Mobile Auth Buttons */}
              {user ? (
                <Link
                  href="/profile"
                  className="block px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#0F3460] rounded-lg"
                  onClick={() => setMobileOpen(false)}
                >
                  My Profile
                </Link>
              ) : (
                <div className="grid grid-cols-2 gap-2 px-3 pb-2">
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="text-center text-sm font-semibold text-[#0F3460] border border-[#0F3460]/20 py-2.5 rounded-lg hover:bg-gray-50">
                    Log in
                  </Link>
                  <Link href="/signup" onClick={() => setMobileOpen(false)} className="text-center text-sm font-bold text-white bg-gradient-to-r from-[#0F3460] to-[#1a5490] py-2.5 rounded-lg">
                    Create account
                  </Link>
                </div>
              )}

              <Link href="/platforms" className="flex items-center gap-2 text-sm font-semibold text-[#1F2937] px-3 py-2.5 rounded-lg hover:bg-gray-50">
                <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                Platforms
              </Link>
              <Link href="/why" className="block text-sm font-semibold text-[#1F2937] px-3 py-2.5 rounded-lg hover:bg-gray-50">
                Why
              </Link>
              <Link href="/daily" className="block text-sm font-semibold text-[#1F2937] px-3 py-2.5 rounded-lg hover:bg-gray-50">
                Daily
              </Link>
              <Link href="/archive" className="block text-sm font-semibold text-[#1F2937] px-3 py-2.5 rounded-lg hover:bg-gray-50">
                Archive
              </Link>
              <Link href="/categories" className="block text-sm font-semibold text-[#1F2937] px-3 py-2.5 rounded-lg hover:bg-gray-50">
                Categories
              </Link>
              <Link href="/about" className="block text-sm font-semibold text-[#1F2937] px-3 py-2.5 rounded-lg hover:bg-gray-50">
                About
              </Link>
              <Link href="/stats" className="block text-sm font-semibold text-[#1F2937] px-3 py-2.5 rounded-lg hover:bg-gray-50">
                Stats
              </Link>
            </div>
          )}
        </div>
      </header>

      {searchOpen && <SearchDialog open onClose={() => setSearchOpen(false)} />}

      {/* Category Filter - Professional (hidden on mobile) */}
      <div className="hidden md:block bg-gray-50 text-[#1F2937] border-b border-gray-200 sticky top-12 sm:top-14 md:top-16 z-30 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="max-w-7xl mx-auto px-2 sm:px-3 md:px-6 py-1.5 sm:py-2 md:py-3 flex gap-1 items-center">
          <CategoryBar />
        </div>
      </div>
    </>
  );
}
