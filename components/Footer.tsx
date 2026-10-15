'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SUPPORT_EMAIL } from '@/lib/site';
import { categoryPath, getCategoryLabel } from '@/lib/categories';

const LINK_GROUPS = [
  {
    title: 'Rankings',
    links: [
      { href: '/', label: 'All Time' },
      { href: '/today', label: 'Today' },
      { href: '/leaderboard', label: 'Leaderboard' },
      { href: '/sponsored', label: 'Sponsored' },
      { href: '/categories', label: 'Categories' },
    ],
  },
  {
    title: 'Discover',
    links: [
      { href: '/platforms', label: 'Platforms' },
      { href: '/daily', label: 'Daily' },
      { href: '/archive', label: 'Archive' },
      { href: '/stats', label: 'Stats' },
    ],
  },
  {
    title: 'Top categories',
    links: ['AIMedia', 'Marketing', 'Productivity', 'Developer', 'SEO', 'Design'].map(c => ({ href: categoryPath(c), label: getCategoryLabel(c) })),
  },
  {
    title: 'Company',
    links: [
      { href: '/why', label: 'Why RankBid' },
      { href: '/about', label: 'About' },
      { href: '/faq', label: 'FAQ' },
      { href: '/rules', label: 'Rules' },
      { href: `mailto:${SUPPORT_EMAIL}`, label: 'Contact' },
    ],
  },
];

const LEGAL_LINKS = [
  { href: '/tos', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/cookies', label: 'Cookies' },
];

export default function Footer() {
  const pathname = usePathname();
  const currentYear = new Date().getFullYear();

  // The coming soon page stands on its own, with no site links; the admin dashboard has its own frame.
  if (pathname === '/coming-soon' || pathname === '/admin' || pathname.startsWith('/admin/')) return null;

  return (
    <footer className="spotlight relative isolate overflow-hidden bg-[#071a33] text-white">
      {/* Background: brand glows + faint grid fading toward the bottom */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/4 w-[40rem] h-[40rem] rounded-full bg-[#1a5490]/35 blur-3xl" />
        <div className="absolute -bottom-40 -right-20 w-[32rem] h-[32rem] rounded-full bg-[#059669]/20 blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Launch CTA */}
        <div className="pt-12 sm:pt-16 pb-4 sm:pb-6 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300/90 mb-3">Launch today</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black leading-tight">
              Your product deserves a spot on the leaderboard.
            </h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 flex-shrink-0">
            <Link
              href="/#submit"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-[#0F3460] text-sm font-black shadow-lg shadow-black/30 hover:-translate-y-0.5 transition-all"
            >
              Submit for free →
            </Link>
            <Link
              href="/categories"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-white/20 bg-white/5 text-white text-sm font-black hover:bg-white/10 transition-all"
            >
              Explore rankings
            </Link>
          </div>
        </div>

        {/* Brand + link columns */}
        <div className="grid grid-cols-2 md:grid-cols-12 gap-x-6 gap-y-10 py-10 sm:py-14">
          <div className="col-span-2 md:col-span-3">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
              <img src="/brand/logo-horizontal-white.png" alt="RankBid" width={823} height={194} className="h-10 w-auto" />
            </Link>
            <p className="text-sm text-white/60 leading-relaxed max-w-sm">
              Community-driven product rankings. No algorithms, no gatekeepers, just honest votes deciding who rises.
            </p>
          </div>

          {LINK_GROUPS.map(group => (
            <nav key={group.title} aria-label={group.title} className="md:col-span-2 md:last:col-span-3">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40 mb-4">{group.title}</h3>
              <ul className="space-y-1">
                {group.links.map(link => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="group inline-flex items-center gap-1.5 py-1.5 text-sm text-white/70 hover:text-white transition-colors"
                    >
                      <span className="w-0 h-px bg-emerald-300 group-hover:w-3 transition-all duration-300" aria-hidden="true" />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-5 text-xs text-white/45">
          <p>© {currentYear} RankBid. All rights reserved.</p>
          <div className="flex items-center gap-5">
            {LEGAL_LINKS.map(link => (
              <Link key={link.label} href={link.href} className="py-1 hover:text-white transition-colors">
                {link.label}
              </Link>
            ))}
            <span className="hidden sm:inline-flex items-center gap-1.5 text-white/55">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </span>
              Rankings live
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
