'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import { CATEGORIES } from '@/lib/categories';
import SelectionHeading from '@/components/SelectionHeading';

// /why banner: a photo across the top, cut by a white wave, with the headline,
// buttons and live numbers below. Every number and card shows real site data.

// Two friends laughing at a phone, from the design reference; the reference's own card and wave are
// whited out of the file and hidden under the wave below.
const PHOTO_SRC = '/why-hero-people.webp';
// Top edge of the white wave (viewBox 1440x320); the shape and its shadow both follow it.
const WAVE_EDGE = 'M0,6 C420,-30 640,120 900,250 C1110,318 1300,290 1440,170';
const PLATFORM_ICONS = ['/instagram.png', '/linkedin.png', '/twitter.png', '/tiktok.png'];

const slideDelay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;
const formatCount = (n: number) => new Intl.NumberFormat('en-US', { notation: n >= 10_000 ? 'compact' : 'standard' }).format(n);

type RankedListing = { totalVotes: number; dayVotes: number };

export default function WhyHero() {
  const [listings, setListings] = useState<RankedListing[]>([]);

  useEffect(() => {
    fetch('/api/listings/submit?limit=1000&sort=totalVotes')
      .then(res => (res.ok ? res.json() : { listings: [] }))
      .then(data => setListings(data.listings || []))
      .catch(() => {});
  }, []);

  const productCount = listings.length;
  const totalVotes = listings.reduce((n, l) => n + (l.totalVotes || 0), 0);
  const votesToday = listings.reduce((n, l) => n + (l.dayVotes || 0), 0);

  const stats = [
    { value: productCount, label: ['Products', 'ranked'] },
    { value: totalVotes, label: ['Community', 'votes'] },
    { value: CATEGORIES.length, label: ['Product', 'categories'] },
  ];

  return (
    <section className="relative overflow-hidden bg-white border-b border-gray-200">
      {/* PHOTO + WAVE */}
      {/* Hidden on phones: the banner starts with the copy there. On large screens it keeps the photo's
          1560x612 shape (39.23vw tall) but never takes more than 56% of the window, so the headline
          below stays in view without scrolling. */}
      <div className="relative hidden sm:block sm:h-[26rem] lg:h-[min(39.23vw,56vh)]">
        <Image
          src={PHOTO_SRC}
          alt="Two friends laughing at a phone"
          fill
          priority
          // Served as-is: the file is already a max-quality WebP, and re-encoding at 75 visibly softened it.
          unoptimized
          className="object-cover object-[56%_30%]"
        />
        {/* Navy colour layer over the photo, in the site's theme blues; under the wave, so the copy is untouched */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#0B2545]/45 via-[#0F3460]/25 to-[#1a5490]/10"
          aria-hidden="true"
        />
        {/* White wave: rises on the left, dips under the phone, lifts again on the right. The photo
            casts a soft navy shadow onto the white just below the curve. */}
        <svg
          className="absolute inset-x-0 bottom-[-1px] h-[48%] w-full text-white"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <clipPath id="why-wave-clip">
              <path d={`${WAVE_EDGE} L1440,320 L0,320 Z`} />
            </clipPath>
            <filter id="why-wave-shadow" x="-5%" y="-50%" width="110%" height="200%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
          </defs>
          <path fill="currentColor" d={`${WAVE_EDGE} L1440,320 L0,320 Z`} />
          <g clipPath="url(#why-wave-clip)">
            <path d={WAVE_EDGE} fill="none" stroke="#0F3460" strokeOpacity="0.32" strokeWidth="22" transform="translate(0 4)" filter="url(#why-wave-shadow)" />
          </g>
        </svg>
      </div>

      {/* COPY + NUMBERS: a 2x2 grid so the card lines up with the paragraph and the stats with the
          buttons. On larger screens the copy is pulled up into the white space under the wave by about a
          quarter of the photo's height (the same min() as the photo, so they stay in step). */}
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-12 sm:pt-0 sm:pb-16 lg:pb-20 sm:-mt-16 lg:mt-[calc(min(39.23vw,56vh)*-0.2422)]">
        <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[1.45fr_1fr]">
          <div>
            <p style={slideDelay(0)} className="slide-up text-[11px] sm:text-xs font-bold uppercase tracking-[0.18em] text-[#0F3460]/60 mb-3 sm:mb-4">Why RankBid</p>
            <SelectionHeading
              as="h1"
              lead="Votes, not budgets,"
              highlight="decide who rises."
              size="text-[2.4rem] sm:text-6xl lg:text-[4rem]"
              style={slideDelay(60)}
              className="slide-up"
            />
            <p style={slideDelay(120)} className="slide-up mt-5 sm:mt-6 max-w-lg text-sm sm:text-base md:text-lg text-[#1F2937]/70">
              RankBid is a free, community-driven launchpad. Real people vote, and the best products climb. No algorithms, no gatekeepers. Want extra visibility? Sponsored spots start at $1 and are always clearly labeled.
            </p>
          </div>

          {/* Votes-today card: its bottom lines up with the paragraph's bottom */}
          <div style={slideDelay(300)} className="slide-up justify-self-start self-start lg:self-end lg:justify-self-end inline-flex items-center gap-4 bg-white rounded-2xl shadow-xl shadow-[#0B2545]/10 border border-gray-100 px-4 py-3">
            <span className="flex -space-x-2.5">
              {PLATFORM_ICONS.map(src => (
                <span key={src} className="grid place-items-center w-9 h-9 rounded-full bg-white ring-2 ring-white shadow">
                  <img src={src} alt="" className="w-5 h-5 object-contain" />
                </span>
              ))}
            </span>
            <span>
              {votesToday > 0 ? (
                <>
                  <span className="block text-lg font-black text-[#0B2545] tabular-nums leading-tight">{formatCount(votesToday)}</span>
                  <span className="block text-xs text-[#1F2937]/70">Vote{votesToday !== 1 ? 's' : ''} cast today</span>
                </>
              ) : (
                <>
                  <span className="block text-sm font-black text-[#0B2545] leading-tight">Voting is open</span>
                  <span className="block text-xs text-[#1F2937]/70">Be the first to vote today</span>
                </>
              )}
            </span>
          </div>

          <div style={slideDelay(180)} className="slide-up flex flex-col sm:flex-row sm:flex-wrap gap-3">
            <Link
              href="/#submit"
              className="inline-flex items-center justify-center px-6 sm:px-7 py-3 sm:py-3.5 rounded-full bg-[#0F3460] text-white text-sm font-bold shadow-lg shadow-[#0F3460]/25 hover:bg-[#0B2545] hover:-translate-y-0.5 transition-all"
            >
              Submit your product · It&apos;s free
            </Link>
            <Link
              href="/categories"
              className="inline-flex items-center justify-center px-6 sm:px-7 py-3 sm:py-3.5 rounded-full border-2 border-[#0F3460]/15 text-[#0B2545] text-sm font-bold hover:border-[#0F3460]/40 transition-colors"
            >
              See the rankings
            </Link>
          </div>

          <dl style={slideDelay(360)} className="slide-up lg:self-center lg:justify-self-end grid grid-cols-3 gap-4 sm:gap-8">
            {stats.map(stat => (
              <div key={stat.label.join(' ')} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5">
                <dt className="sr-only">{stat.label.join(' ')}</dt>
                <dd className="text-3xl sm:text-4xl font-black tracking-tight text-[#0B2545] tabular-nums">{formatCount(stat.value)}</dd>
                <dd aria-hidden="true" className="text-xs sm:text-sm leading-tight text-[#1F2937]/70">
                  {stat.label[0]}<br />{stat.label[1]}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
