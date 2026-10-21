'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';

export interface TodayRankingItem {
  id: string;
  title: string;
  url: string;
  imageUrl?: string | null;
  /** Shown on the right: the price for sponsored spots, the day's votes for the rankings. */
  value: string;
}

const FALLBACK_ICON =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%230F3460" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';

function faviconFor(url: string): string {
  try {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(url).hostname)}&sz=128`;
  } catch {
    return FALLBACK_ICON;
  }
}

const themes = {
  amber: { dot: 'bg-amber-500', link: 'text-amber-700', value: 'text-amber-600', card: 'bg-amber-50/40 border-amber-200/70' },
  navy: { dot: 'bg-[#0F3460]', link: 'text-[#0F3460]', value: 'text-[#0F3460]', card: 'bg-white border-gray-200' },
};

function Logo({ item }: { item: TodayRankingItem }) {
  const [src, setSrc] = useState(() => faviconFor(item.url));
  return (
    <img
      src={src}
      alt=""
      width={40}
      height={40}
      loading="lazy"
      className="w-9 h-9 flex-shrink-0 rounded-xl bg-white border border-gray-100 p-1 object-contain"
      onError={() => setSrc(item.imageUrl && src !== item.imageUrl ? item.imageUrl : FALLBACK_ICON)}
    />
  );
}

/** Compact "Today's ranking" side card: the day's top few, each opening its product page. */
export default function TodayRankingCard({
  items,
  seeAllHref,
  theme,
  loading = false,
  empty,
  title = "Today's ranking",
}: {
  items: TodayRankingItem[];
  seeAllHref: string;
  theme: keyof typeof themes;
  loading?: boolean;
  /** Shown when nothing ranks yet today. */
  empty: ReactNode;
  title?: string;
}) {
  const t = themes[theme];
  return (
    <aside className={`rounded-2xl border p-4 sm:p-5 ${t.card}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="flex items-center gap-2 text-base font-black text-[#1F2937]">
          <span className={`w-2 h-2 rounded-full ${t.dot}`} aria-hidden="true" />
          {title}
        </h3>
        <Link href={seeAllHref} className={`text-xs sm:text-sm font-bold ${t.link} hover:underline whitespace-nowrap`}>
          See all ›
        </Link>
      </div>

      {loading && items.length === 0 ? (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="py-3 text-sm text-[#1F2937]/60">{empty}</div>
      ) : (
        <ol className="space-y-1">
          {items.map((item, i) => (
            <li key={item.id}>
              <Link
                href={`/product/${item.id}`}
                className="flex items-center gap-3 rounded-xl px-1.5 py-2 hover:bg-black/[0.03] transition-colors"
              >
                <span className="w-6 flex-shrink-0 text-sm font-black text-[#1F2937]/50 tabular-nums">#{i + 1}</span>
                <Logo item={item} />
                <span className="flex-1 min-w-0 truncate text-sm font-semibold text-[#1F2937]">{item.title}</span>
                <span className={`flex-shrink-0 text-sm font-black tabular-nums ${t.value}`}>{item.value}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
