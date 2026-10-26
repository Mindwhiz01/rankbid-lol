'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import SelectionHeading from '@/components/SelectionHeading';
import { REVIEWS } from '@/lib/reviews';
import { SUPPORT_EMAIL } from '@/lib/site';

interface TrustedByProps {
  products: number;
  votes: number;
  categories: number;
}

// Orbit layout (traced from the design): each avatar sits on a ring at a fixed angle.
// Ring sizes are a fraction of the orbit's width; avatars are ~13.5% of the orbit wide.
const OUTER_RING = 0.917;
const INNER_RING = 0.515;
const AVATAR = 0.135;
const ORBIT = [
  { src: '/orbit/a1.jpg', ring: 'outer', angle: -58.8 },
  { src: '/orbit/a2.jpg', ring: 'outer', angle: -153.7 },
  { src: '/orbit/a3.jpg', ring: 'outer', angle: 42.5 },
  { src: '/orbit/a4.jpg', ring: 'outer', angle: 113.2 },
  { src: '/orbit/a5.jpg', ring: 'inner', angle: -107.3 },
  { src: '/orbit/a6.jpg', ring: 'inner', angle: -19.9 },
  { src: '/orbit/a7.jpg', ring: 'inner', angle: 134.1 },
] as const;

// Each step turns the outer ring one way and the inner ring the other.
const STEP_DEG = 360 / ORBIT.length;
const AUTO_MS = 5000;

function Stars({ rating }: { rating: number }) {
  return (
    <div role="img" className="flex gap-0.5 text-amber-400" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} className={`w-4 h-4 ${i < rating ? '' : 'opacity-25'}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9L12 2.5z" />
        </svg>
      ))}
    </div>
  );
}

function Ring({ which, turn, active }: { which: 'outer' | 'inner'; turn: number; active: number }) {
  const size = which === 'outer' ? OUTER_RING : INNER_RING;
  const deg = (which === 'outer' ? -1 : 1) * turn * STEP_DEG;
  const avatarPct = (AVATAR / size) * 100;

  return (
    <div
      className="absolute left-1/2 top-1/2 rounded-full border border-[#0B2545]/25 transition-transform duration-[1200ms] ease-[cubic-bezier(0.65,0,0.35,1)]"
      style={{ width: `${size * 100}%`, height: `${size * 100}%`, transform: `translate(-50%, -50%) rotate(${deg}deg)` }}
    >
      {ORBIT.map((a, i) => {
        if (a.ring !== which) return null;
        const rad = (a.angle * Math.PI) / 180;
        const isActive = i === active;
        const review = REVIEWS[i];
        return (
          <span
            key={a.src}
            className="absolute"
            style={{
              width: `${avatarPct}%`,
              height: `${avatarPct}%`,
              left: `${50 + 50 * Math.cos(rad)}%`,
              top: `${50 + 50 * Math.sin(rad)}%`,
              // Undo the ring's rotation so faces stay upright.
              transform: `translate(-50%, -50%) rotate(${-deg}deg)`,
              transition: 'transform 1200ms cubic-bezier(0.65,0,0.35,1)',
            }}
          >
            <img
              src={review?.avatar || a.src}
              alt=""
              loading="lazy"
              className={`w-full h-full rounded-full object-cover bg-white transition-all duration-500 ${
                isActive
                  ? 'scale-[1.18] ring-[3px] ring-[#059669] ring-offset-2 ring-offset-white shadow-[0_12px_30px_-10px_rgba(5,150,105,0.6)]'
                  : 'ring-1 ring-[#0B2545]/30'
              }`}
            />
          </span>
        );
      })}
    </div>
  );
}

/** "Trusted by makers": rotating orbit of faces, live platform numbers, and real reviews from lib/reviews.ts. */
export default function TrustedBy({ products, votes, categories }: TrustedByProps) {
  const [turn, setTurn] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = REVIEWS.length;
  const index = count ? ((turn % count) + count) % count : 0;
  const review = count ? REVIEWS[index] : null;
  // With reviews, highlight the face in the current review's slot; otherwise just follow the rotation.
  const activeAvatar = count ? index % ORBIT.length : ((turn % ORBIT.length) + ORBIT.length) % ORBIT.length;

  // Keep the orbit moving on its own; pause while the visitor is interacting.
  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setTurn(n => n + 1), AUTO_MS);
    return () => clearInterval(t);
  }, [paused]);

  const stats = [
    { value: products, label: 'products listed' },
    { value: votes, label: 'community votes' },
    { value: categories, label: 'categories with products' },
  ];

  const navBtn =
    'w-11 h-11 rounded-full border border-[#0B2545]/15 text-[#0B2545] flex items-center justify-center hover:bg-[#0F3460] hover:text-white hover:border-[#0F3460] transition-colors';

  return (
    <section
      className="py-14 sm:py-20 md:py-24 bg-white border-t border-gray-200 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Copy, numbers, review */}
        <div>
          <SelectionHeading
            lead="trusted by"
            highlight="makers"
            sub="Founders, agencies and creators launch here and let real votes do the talking."
            className="mb-8 sm:mb-10"
          />

          <dl className="flex flex-wrap gap-x-10 gap-y-4 mb-10 sm:mb-12">
            {stats.map(s => (
              <div key={s.label}>
                <dd className="text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#0B2545] tabular-nums">
                  {s.value ? s.value.toLocaleString('en-US') : '—'}
                </dd>
                <dt className="text-xs sm:text-sm text-[#1F2937]/70 mt-1">{s.label}</dt>
              </div>
            ))}
          </dl>

          {review ? (
            <figure aria-live="polite" className="relative pl-5 min-h-[11rem]">
              <span aria-hidden="true" className="absolute left-0 top-1 bottom-1 w-[3px] bg-[#059669]">
                <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#059669]" />
              </span>
              {/* Keyed so each new review slides in */}
              <div key={index} className="slide-up">
                <div className="flex items-center gap-3">
                  {review.rating ? <Stars rating={review.rating} /> : null}
                  {review.example && (
                    <span className="px-2 py-0.5 rounded-full bg-[#0F3460]/[0.07] text-[10px] font-bold uppercase tracking-wider text-[#0F3460]/60">
                      Example review
                    </span>
                  )}
                </div>
                <blockquote className="mt-3 text-lg sm:text-xl text-[#0B2545] leading-relaxed tracking-[-0.01em]">
                  “{review.quote}”
                </blockquote>
                <figcaption className="mt-4 text-sm">
                  <span className="font-bold text-[#0B2545]">{review.name}</span>
                  <span className="text-[#1F2937]/70">
                    {' · '}
                    {review.href ? <a href={review.href} className="hover:text-[#0F3460] hover:underline underline-offset-2">{review.role}</a> : review.role}
                  </span>
                </figcaption>
              </div>
            </figure>
          ) : (
            <div className="relative pl-5">
              <span aria-hidden="true" className="absolute left-0 top-1 bottom-1 w-[3px] bg-[#0F3460]/15" />
              <p className="text-lg text-[#0B2545] leading-relaxed tracking-[-0.01em]">
                Launched on RankBid? Tell us how it went and your review could appear here.
              </p>
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('My RankBid review')}`}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#0F3460] hover:underline underline-offset-2"
              >
                Share your experience →
              </a>
            </div>
          )}

          {count > 1 && (
            <div className="mt-8 flex items-center gap-3">
              <button type="button" aria-label="Previous review" onClick={() => setTurn(n => n - 1)} className={navBtn}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <button type="button" aria-label="Next review" onClick={() => setTurn(n => n + 1)} className={navBtn}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
              </button>
              <span className="ml-2 text-xs font-bold text-[#1F2937]/70 tabular-nums">
                {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
              </span>
            </div>
          )}
        </div>

        {/* Orbit: left on desktop, below the copy on phones */}
        <div className="relative w-full max-w-[520px] mx-auto aspect-square lg:order-first" aria-hidden="true">
          <Ring which="outer" turn={turn} active={activeAvatar} />
          <Ring which="inner" turn={turn} active={activeAvatar} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[17%] h-[17%] rounded-full bg-[#059669]/15 flex items-center justify-center">
            <span className="w-[62%] h-[62%] rounded-[30%] bg-white flex items-center justify-center shadow-lg shadow-[#0F3460]/30">
              <Image src="/brand/logo-mark.png" alt="" width={223} height={194} sizes="96px" className="w-[70%] h-auto" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
