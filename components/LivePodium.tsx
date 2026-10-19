'use client';

import { useCallback, useEffect, useState } from 'react';
import { getCategoryLabel } from '@/lib/categories';
import { isSponsoredPreview, SPONSORED_PREVIEW } from '@/lib/sponsoredPreview';
import FounderLinks, { type FounderSocials } from '@/components/FounderLinks';

interface PodiumListing extends FounderSocials {
  id: string;
  title: string;
  url?: string;
  imageUrl?: string | null;
  category: string;
  clickCount?: number;
  premiumBidUsd?: number | null;
}

// How often the podium re-reads the paid spots while the tab is visible.
const REFRESH_MS = 30_000;

const FALLBACK_ICON =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%230F3460" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';

function logoFor(l: PodiumListing): string {
  try {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(l.url || '').hostname)}&sz=128`;
  } catch {
    return l.imageUrl || FALLBACK_ICON;
  }
}

/** Product logo. Falls back to the listing image, then a plain mark. */
function PodiumLogo({ listing, rank }: { listing: PodiumListing; rank: number }) {
  const first = rank === 0;
  return (
    <div className={`relative mx-auto mb-3 sm:mb-4 ${first ? 'w-16 h-16 sm:w-20 sm:h-20' : 'w-14 h-14 sm:w-16 sm:h-16'}`}>
      <img
        src={logoFor(listing)}
        alt={`${listing.title} logo`}
        width={80}
        height={80}
        className={`w-full h-full rounded-2xl bg-white object-contain p-2 sm:p-2.5 ${first ? 'shadow-lg shadow-black/20' : 'border border-gray-100 shadow-sm'}`}
        onError={e => {
          const img = e.currentTarget;
          img.src = listing.imageUrl && !img.dataset.fellBack ? listing.imageUrl : FALLBACK_ICON;
          img.dataset.fellBack = '1';
        }}
      />
    </div>
  );
}

/** The paid #1-#3 spots. Open spots open the claim form (onClaim), or link to the leaderboard without it. */
export default function LivePodium({ onClaim }: { onClaim?: (position: number) => void }) {
  const [listings, setListings] = useState<PodiumListing[] | null>(null);

  const load = useCallback(async () => {
    if (isSponsoredPreview()) {
      setListings(SPONSORED_PREVIEW);
      return;
    }
    try {
      const res = await fetch('/api/listings/submit?page=1&pageSize=1', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setListings(data.premium || []);
    } catch {
      // Keep showing the last good result; the next tick retries.
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const holderAt = (position: number) => (listings || []).find(l => l.premiumPosition === position);

  // Podium order on desktop: 2nd, 1st, 3rd. On mobile 1st stays on top.
  const slots = [1, 0, 2];

  return (
    <div>
      <div className="flex justify-center mb-8 sm:mb-12">
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#1F2937]/55">
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-[#059669] animate-ping opacity-60" />
            <span className="relative w-2 h-2 rounded-full bg-[#059669]" />
          </span>
          Sponsored · Live
        </span>
      </div>

      {listings === null ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6 md:items-end">
          {slots.map(rank => (
            <div
              key={rank}
              className={`${rank === 0 ? 'h-56 md:-translate-y-4' : 'h-48 order-2 md:order-none'} rounded-2xl bg-white border border-gray-100 animate-pulse`}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6 md:items-end">
          {slots.map(rank => {
            const first = rank === 0;
            const l = holderAt(rank + 1);
            const card = `block rounded-2xl text-center transition-all duration-300 hover:-translate-y-1 ${
              first ? 'md:-translate-y-4 md:hover:-translate-y-5' : 'order-2 md:order-none'
            }`;

            if (!l) {
              return (
                <a
                  key={rank}
                  href="#leaderboard"
                  onClick={e => {
                    if (!onClaim) return;
                    e.preventDefault();
                    onClaim(rank + 1);
                  }}
                  className={`${card} border-2 border-dashed border-amber-200 bg-white/60 hover:border-amber-400 hover:bg-amber-50/60 ${first ? 'p-6 sm:p-8' : 'p-5 sm:p-6'}`}
                >
                  <p className={`font-black text-amber-600/70 tabular-nums ${first ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'}`}>#{rank + 1}</p>
                  <p className="mt-2 text-[11px] font-black uppercase tracking-wider text-amber-700">Open</p>
                  <p className="mt-1 text-xs font-semibold text-[#1F2937]/50">Feature your product here</p>
                  <p className="mt-3 text-xs sm:text-sm font-black text-amber-700">Claim this spot →</p>
                </a>
              );
            }

            const clicks = l.clickCount || 0;
            // The title's link stretches over the whole card; founder links sit above it.
            return (
              <div
                key={rank}
                className={`${card} relative ${
                  first
                    ? 'bg-gradient-to-br from-[#0F3460] to-[#1a5490] text-white p-6 sm:p-8 shadow-[0_24px_50px_-24px_rgba(11,37,69,0.7)]'
                    : 'bg-white border border-gray-200 shadow-sm hover:shadow-md p-5 sm:p-6'
                }`}
              >
                <PodiumLogo listing={l} rank={rank} />
                <h3 className={`${first ? 'text-base sm:text-lg font-black' : 'text-sm sm:text-base font-bold text-[#1F2937]'} mb-1 truncate`}>
                  <a href={`/product/${l.id}`} className="after:absolute after:inset-0 after:rounded-2xl after:content-['']">
                    {l.title}
                  </a>
                </h3>
                <p className={`text-xs mb-3 sm:mb-4 ${first ? 'text-white/70' : 'text-[#1F2937]/60'}`}>{getCategoryLabel(l.category)}</p>
                {/* Sponsored rank (by price) */}
                <p className={`font-black tabular-nums ${first ? 'text-3xl sm:text-4xl text-amber-300' : 'text-2xl sm:text-3xl text-amber-600'}`}>
                  #{rank + 1}
                </p>
                <p className={`text-xs font-semibold ${first ? 'text-white/70' : 'text-[#1F2937]/60'}`}>
                  {clicks.toLocaleString('en-US')} {clicks === 1 ? 'click' : 'clicks'}
                  {l.premiumBidUsd != null && (
                    <span className={first ? 'text-amber-300' : 'text-amber-600'}> · ${Number(l.premiumBidUsd).toLocaleString('en-US')} bid</span>
                  )}
                </p>
                {/* The link row keeps its height even when empty, so #2 and #3 line up with or without links */}
                <div className="mt-3 sm:mt-4 h-7 flex justify-center">
                  <FounderLinks listing={l} title={l.title} size="md" className="justify-center" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
