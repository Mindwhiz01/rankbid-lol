'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Header from '@/components/Header';
import PageHero from '@/components/PageHero';
import PlatformIcon from '@/components/PlatformIcon';
import { PremiumIcons } from '@/components/PremiumIcons';
import { getCategoryLabel } from '@/lib/categories';
import { PLATFORM_LABELS, normalizePlatform } from '@/lib/platform-url';

interface ListingLite {
  category?: string;
  platform?: string;
  totalVotes?: number;
  dayVotes?: number;
}

interface Stats {
  products: number;
  totalVotes: number;
  votesToday: number;
  visitors: number;
  pageViews: number;
  online: number;
  categories: { name: string; count: number }[];
  platforms: { name: string; count: number }[];
}

function topCounts(values: string[], limit: number) {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, limit);
}

function StatCard({ icon, tone, label, value }: { icon: ReactNode; tone: 'navy' | 'green'; label: string; value: string }) {
  return (
    <div className="px-4 sm:px-6 py-4 sm:py-5">
      <div className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${tone === 'green' ? 'text-[#059669]' : 'text-[#0F3460]'}`}>
        <span className="[&>svg]:w-4 [&>svg]:h-4">{icon}</span>
        <span className="text-[#1F2937]/70">{label}</span>
      </div>
      <p className="text-2xl sm:text-3xl font-black text-[#1F2937] leading-tight tabular-nums">{value}</p>
    </div>
  );
}

function BarList({ title, rows, total, renderLabel }: { title: string; rows: { name: string; count: number }[]; total: number; renderLabel: (name: string) => ReactNode }) {
  return (
    <div>
      <h2 className="text-base sm:text-lg font-black text-[#1F2937] mb-4 sm:mb-5">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-xs sm:text-sm text-[#1F2937]/70">No data yet</p>
      ) : (
        <div className="space-y-3">
          {rows.map(row => {
            const pct = total ? Math.round((row.count / total) * 100) : 0;
            return (
              <div key={row.name}>
                <div className="flex justify-between items-center mb-1.5 text-xs sm:text-sm">
                  <span className="font-semibold text-[#1F2937] flex items-center gap-2">{renderLabel(row.name)}</span>
                  <span className="text-[#1F2937]/70 font-semibold">{row.count} · {pct}%</span>
                </div>
                <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#0F3460] to-[#1a5490] transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString('en-US');

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [listingsRes, totalsRes, liveRes] = await Promise.all([
          fetch('/api/listings/submit?limit=1000'),
          fetch('/api/analytics/total-stats'),
          fetch('/api/analytics/live-viewers'),
        ]);
        const listings: ListingLite[] = listingsRes.ok ? (await listingsRes.json()).listings || [] : [];
        const totals = totalsRes.ok ? await totalsRes.json() : {};
        const live = liveRes.ok ? await liveRes.json() : {};

        setStats({
          products: listings.length,
          totalVotes: listings.reduce((sum, l) => sum + (l.totalVotes || 0), 0),
          votesToday: listings.reduce((sum, l) => sum + (l.dayVotes || 0), 0),
          visitors: totals.totalVisitors || 0,
          pageViews: totals.totalPageViews || 0,
          online: live.liveViewers || 0,
          categories: topCounts(listings.map(l => l.category || 'Other'), 6),
          platforms: topCounts(listings.map(l => (l.platform === 'x' ? 'twitter' : l.platform || 'website')), 6),
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchStats();
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const v = (n: number | undefined) => (stats ? fmt(n || 0) : '—');

  return (
    <>
      <Header />
      <div className="bg-white min-h-screen">
        <PageHero title="RankBid Statistics" subtitle="Live numbers from the platform, refreshed every 15 seconds." />

        <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-10 md:py-12 space-y-4 sm:space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-6 rounded-2xl border border-gray-200 bg-white shadow-sm divide-x divide-y lg:divide-y-0 divide-gray-100 overflow-hidden [&>*:nth-child(2n+1)]:border-l-0 lg:[&>*:nth-child(2n+1)]:border-l">
            <StatCard icon={<PremiumIcons.Layers />} tone="navy" label="Products listed" value={v(stats?.products)} />
            <StatCard icon={<PremiumIcons.Ballot />} tone="green" label="Total votes" value={v(stats?.totalVotes)} />
            <StatCard icon={<PremiumIcons.Bolt />} tone="navy" label="Votes today" value={v(stats?.votesToday)} />
            <StatCard icon={<PremiumIcons.Globe />} tone="green" label="Visitors (all time)" value={v(stats?.visitors)} />
            <StatCard icon={<PremiumIcons.Eye />} tone="navy" label="Page views" value={v(stats?.pageViews)} />
            <StatCard icon={<PremiumIcons.Pulse />} tone="green" label="Online now" value={v(stats?.online)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 pt-6 sm:pt-10">
            <BarList
              title="Top Categories"
              rows={stats?.categories || []}
              total={stats?.products || 0}
              renderLabel={name => getCategoryLabel(name)}
            />
            <BarList
              title="Top Platforms"
              rows={stats?.platforms || []}
              total={stats?.products || 0}
              renderLabel={name => (
                <>
                  <PlatformIcon platform={name} size={16} />
                  <span>{name === 'twitter' ? 'X' : PLATFORM_LABELS[normalizePlatform(name)]}</span>
                </>
              )}
            />
          </div>
        </div>
      </div>
    </>
  );
}
