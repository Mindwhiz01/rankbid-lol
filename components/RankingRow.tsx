'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import PlatformIcon from '@/components/PlatformIcon';
import StatusCardModal from '@/components/StatusCardModal';
import { getCategoryLabel } from '@/lib/categories';
import { useVote } from '@/lib/useVote';
import { supportUrl } from '@/lib/site';
import { safeExternalUrl } from '@/lib/utils';
import { claimClick } from '@/lib/clickCount';

export interface RankingListing {
  id: string;
  url: string;
  title: string;
  description?: string;
  category: string;
  platform?: string;
  /** Site visits through /api/click. Hidden when the source doesn't send it. */
  clickCount?: number;
}

const FALLBACK_ICON =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%230F3460" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';

function faviconFor(url: string): string {
  try {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(url).hostname)}&sz=64`;
  } catch {
    return FALLBACK_ICON;
  }
}

const rankBadge: Record<number, string> = {
  1: 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-amber-500/30',
  2: 'bg-gradient-to-br from-[#A0673D] to-[#7A4A26] text-white shadow-[#7A4A26]/30',
  3: 'bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-slate-400/30',
};

/**
 * One row of a ranking list. Title opens the on-site product page (keeps visitors on RankBid);
 * the arrow opens the product's own site. Vote and Share work the same as on the homepage.
 */
export default function RankingRow({
  listing,
  rank,
  votes,
  votesLabel = 'votes',
  onPremium,
}: {
  listing: RankingListing;
  rank: number;
  votes: number;
  votesLabel?: string;
  /** Shows a "Premium" upsell button when provided (homepage opens the premium modal). */
  onPremium?: () => void;
}) {
  const { voted, extraVotes, message, vote: handleVote } = useVote(listing.id, votes);
  const [shareOpen, setShareOpen] = useState(false);
  const [clicks, setClicks] = useState(listing.clickCount);
  const bumpClicks = () => {
    if (claimClick(listing.id)) setClicks(c => (c === undefined ? c : c + 1));
  };

  const platform = listing.platform || 'website';
  const badge = rankBadge[rank] ?? 'bg-[#0F3460] text-white shadow-[#0F3460]/20';
  // Taking this rank means passing its votes, so it takes one more than it has.
  const votesToClaim = votes + extraVotes + 1;

  return (
    <>
      <div className="spotlight-light group relative flex items-center gap-2 sm:gap-4 p-2.5 sm:p-3.5 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-[#0F3460]/25 transition-all duration-200">
        <span
          aria-hidden="true"
          className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap rounded-full bg-[#0F3460] px-3 py-0.5 text-[11px] sm:text-xs font-black text-white shadow-md opacity-0 pointer-events-none translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200"
        >
          {votesToClaim.toLocaleString('en-US')} {votesToClaim === 1 ? 'vote' : 'votes'} to claim this rank
        </span>

        {/* Rank */}
        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-xs sm:text-sm font-black shadow-md ${badge}`}>
          #{rank}
        </div>

        {/* Logo */}
        <img
          src={faviconFor(listing.url)}
          alt={`${listing.title} logo`}
          className="max-[379px]:hidden w-8 h-8 sm:w-10 sm:h-10 rounded-lg border border-gray-100 bg-white p-1 flex-shrink-0 object-contain"
          onError={(e) => { e.currentTarget.src = FALLBACK_ICON; }}
        />

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/product/${listing.id}`}
              onClick={bumpClicks}
              className="text-xs sm:text-sm font-bold text-[#1F2937] truncate hover:text-[#0F3460] transition-colors after:absolute after:inset-0 after:content-['']"
            >
              {listing.title}
            </Link>
            <span className="relative z-10 flex-shrink-0" title={platform}>
              <PlatformIcon platform={platform} size={14} />
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 min-w-0">
            <span className="text-[11px] sm:text-xs font-semibold text-[#0F3460] bg-[#0F3460]/5 px-1.5 py-0.5 rounded whitespace-nowrap truncate max-w-[9rem] sm:max-w-none">
              {getCategoryLabel(listing.category)}
            </span>
            {clicks !== undefined && (
              <span className="text-[11px] sm:text-xs font-semibold text-[#1F2937]/50 whitespace-nowrap">
                {clicks.toLocaleString('en-US')} {clicks === 1 ? 'click' : 'clicks'}
              </span>
            )}
            {message && <span className="text-[11px] sm:text-xs font-semibold text-[#059669]">{message}</span>}
          </div>
        </div>

        {/* Votes */}
        <div className="text-center flex-shrink-0 sm:px-1">
          <p className="text-base sm:text-xl font-black text-[#0F3460] leading-none">{votes + extraVotes}</p>
          <p className="text-[10px] sm:text-[11px] text-[#1F2937]/50 font-semibold mt-0.5">{votesLabel === 'votes' && votes + extraVotes === 1 ? 'vote' : votesLabel}</p>
        </div>

        {/* Actions (above the stretched title link) */}
        <div className="relative z-10 flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          <button
            onClick={handleVote}
            aria-label={voted ? `Remove your vote for ${listing.title}` : `Vote for ${listing.title}`}
            title={voted ? 'Click to remove your vote' : undefined}
            className={`inline-flex items-center justify-center gap-1 h-8 min-w-8 px-2 sm:px-3 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-60 ${
              voted
                ? 'bg-[#059669]/10 text-[#059669] hover:bg-red-50 hover:text-red-600'
                : 'bg-[#0F3460] text-white hover:bg-[#0D2A50] shadow-sm'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={voted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.5s-8.5-4.8-8.5-11A4.5 4.5 0 0112 7a4.5 4.5 0 018.5 2.5c0 6.2-8.5 11-8.5 11z" />
            </svg>
            <span className="hidden sm:inline">{voted ? 'Voted' : 'Vote'}</span>
          </button>
          <button
            onClick={() => setShareOpen(true)}
            aria-label={`Share ${listing.title}`}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-[#1F2937]/70 hover:text-[#0F3460] hover:border-[#0F3460]/30 transition-all active:scale-95"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7M16 6l-4-4-4 4M12 2v13" />
            </svg>
          </button>
          {onPremium && (
            <button
              onClick={onPremium}
              title="Get a sponsored spot"
              aria-label={`Get a sponsored spot for ${listing.title}`}
              className="hidden sm:inline-flex items-center justify-center w-8 h-8 rounded-lg border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all active:scale-95"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9L12 2.5z" />
              </svg>
            </button>
          )}
          <a
            href={safeExternalUrl(listing.url) ? `/api/click?id=${encodeURIComponent(listing.id)}` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={bumpClicks}
            aria-label={`Visit ${listing.title}`}
            className="hidden sm:inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-[#1F2937]/70 hover:text-[#0F3460] hover:border-[#0F3460]/30 transition-all"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
        </div>
      </div>

      {/* Portaled to <body> so a transformed list row (e.g. .curve-list) can't trap the fixed overlay */}
      {shareOpen && createPortal(
        <StatusCardModal
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          product={{
            id: listing.id,
            title: listing.title,
            description: listing.description || '',
            category: listing.category,
            platform,
            totalVotes: votes + extraVotes,
            rank,
          }}
          productUrl={supportUrl(listing.id)}
        />,
        document.body
      )}
    </>
  );
}
