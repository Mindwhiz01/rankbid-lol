'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getCategoryLabel } from '@/lib/categories';
import { safeExternalUrl } from '@/lib/utils';
import { claimClick } from '@/lib/clickCount';
import FounderLinks, { type FounderSocials } from '@/components/FounderLinks';

export interface SponsoredListing extends FounderSocials {
  id: string;
  title: string;
  description?: string;
  url: string;
  category: string;
  createdAt?: string;
  imageUrl?: string | null;
  totalVotes: number;
  clickCount?: number;
  premiumBidUsd?: number | null;
}

const FALLBACK_ICON =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%230F3460" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function logoFor(url: string): string {
  const host = hostOf(url);
  return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128` : FALLBACK_ICON;
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
function timeAgo(iso?: string): string {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(t)) return '';
  const days = Math.round((t - Date.now()) / 86_400_000);
  if (days > -1) return 'today';
  if (days > -7) return relative.format(days, 'day');
  if (days > -30) return relative.format(Math.round(days / 7), 'week');
  if (days > -365) return relative.format(Math.round(days / 30), 'month');
  return relative.format(Math.round(days / 365), 'year');
}

/**
 * One sponsored listing (ranked by price). The whole row opens the product's page; the site name visits the
 * product through /api/click, which counts the click before redirecting. The site and founder links sit above
 * the stretched link. Paid spots are ranked by price, so they carry no vote button.
 */
export default function SponsoredRow({ listing }: { listing: SponsoredListing }) {
  const [clicks, setClicks] = useState(listing.clickCount || 0);
  const [logo, setLogo] = useState(() => logoFor(listing.url));

  const position = listing.premiumPosition || 1;
  // Preview rows (lib/sponsoredPreview.ts) are not in the database, so they have no page and link straight out.
  const preview = listing.id.startsWith('preview-');
  const visitHref = preview ? safeExternalUrl(listing.url) ?? '#' : `/api/click?id=${encodeURIComponent(listing.id)}`;
  const host = hostOf(listing.url);
  const ago = timeAgo(listing.createdAt);
  const meta = 'text-[#1F2937]/50 font-semibold';

  return (
    <div className="group relative flex items-start sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-amber-50/70 border border-amber-200/70 hover:bg-amber-50 hover:border-amber-300 hover:shadow-md transition-all duration-200">
      <span className="w-7 sm:w-9 flex-shrink-0 pt-4 sm:pt-0 text-sm sm:text-lg font-black text-amber-600 tabular-nums">#{position}</span>

      <img
        src={logo}
        alt={`${listing.title} logo`}
        width={64}
        height={64}
        loading="lazy"
        className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 rounded-xl sm:rounded-2xl bg-white border border-amber-100 p-1.5 sm:p-2 object-contain shadow-sm"
        onError={() => setLogo(listing.imageUrl && logo !== listing.imageUrl ? listing.imageUrl : FALLBACK_ICON)}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3">
          <Link
            href={preview ? visitHref : `/product/${listing.id}`}
            className="flex-1 min-w-0 truncate text-sm sm:text-base font-black text-[#1F2937] group-hover:text-[#0F3460] transition-colors after:absolute after:inset-0 after:content-['']"
          >
            {listing.title}
          </Link>
          {listing.premiumBidUsd != null && (
            <span className="flex-shrink-0 text-sm sm:text-lg font-black text-amber-600 tabular-nums">
              ${Number(listing.premiumBidUsd).toLocaleString('en-US')}
            </span>
          )}
        </div>

        {listing.description && (
          <p className="text-xs sm:text-sm text-[#1F2937]/55 truncate mt-0.5">{listing.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-1 text-[11px] sm:text-xs">
          <span className="font-bold text-[#0F3460]">{getCategoryLabel(listing.category)}</span>
          {ago && <><span className={meta}>·</span><span className={meta}>{ago}</span></>}
          <span className={meta}>·</span>
          <a
            href={visitHref}
            target="_blank"
            rel="noopener sponsored"
            onClick={() => { if (preview || claimClick(listing.id)) setClicks(c => c + 1); }}
            className="relative z-10 font-bold text-[#1F2937]/70 underline-offset-2 hover:text-[#0F3460] hover:underline transition-colors"
          >
            {host || 'Visit site'} ↗
          </a>
          <span className={meta}>·</span>
          <span className={meta}>{clicks.toLocaleString('en-US')} {clicks === 1 ? 'click' : 'clicks'}</span>
          <FounderLinks listing={listing} title={listing.title} className="ml-1" />
        </div>
      </div>
    </div>
  );
}
