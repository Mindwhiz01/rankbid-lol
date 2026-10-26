'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

// Photo of a person on their phone against a blue sky, which blends into the
// panel's navy. Drop the file into /public to show it.
const PHOTO_SRC = '/cta-person.jpg';

// Fades the photo into the panel: from the left on desktop, from the bottom
// on mobile where it sits above the copy.
const FADE_LEFT = 'linear-gradient(to right, transparent, black 40%)';
const FADE_BOTTOM = 'linear-gradient(to bottom, black 55%, transparent)';

// Words the heading cycles through, one at a time.
const WORDS = ['product', 'brand', 'profile', 'startup', 'store'];
const WORD_MS = 2200;

// "Give your ___ the reach…": each word slides up out of the way as the next
// one slides in, and the slot eases to the new word's width.
function RotatingWord() {
  const [index, setIndex] = useState(0);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [widths, setWidths] = useState<number[]>([]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setIndex(i => (i + 1) % WORDS.length), WORD_MS);
    return () => clearInterval(id);
  }, []);

  // Measure every word; the heading's font size changes across breakpoints.
  useEffect(() => {
    const measure = () => setWidths(wordRefs.current.map(el => el?.offsetWidth ?? 0));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const prev = (index - 1 + WORDS.length) % WORDS.length;

  return (
    // No overflow-hidden here: on an inline-block it moves the baseline to the
    // bottom edge and lifts the word off the line. clip-path hides the sliding
    // words instead, with room below for descenders and the underline.
    <span
      className="relative inline-block whitespace-nowrap transition-[width] duration-500 ease-out"
      style={{ width: widths[index] || undefined, clipPath: 'inset(0 -0.1em -0.25em)' }}
    >
      {/* Invisible copy of the current word sets the baseline and height */}
      <span className="invisible">{WORDS[index]}</span>
      {WORDS.map((word, i) => {
        const state = i === index ? 'translate-y-0 opacity-100' : i === prev ? '-translate-y-full opacity-0' : 'translate-y-full opacity-0';
        return (
          <span
            key={word}
            ref={el => { wordRefs.current[i] = el; }}
            aria-hidden={i !== index}
            className={`absolute left-0 top-0 transition-[transform,opacity] duration-500 ease-out ${state}`}
          >
            {word}
          </span>
        );
      })}
      {/* Underline in the brand green */}
      <span className="absolute inset-x-0 -bottom-[0.06em] h-[0.08em] rounded-full bg-emerald-300" aria-hidden="true" />
    </span>
  );
}

// Closing call-to-action for the home page: copy on the left, a photo
// filling the right of the panel.
export default function HomeCta() {
  const imgRef = useRef<HTMLImageElement>(null);
  const [hasPhoto, setHasPhoto] = useState(true);

  // The image can fail before hydration, when onError isn't attached yet.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth === 0) setHasPhoto(false);
  }, []);

  return (
    <section className="relative overflow-hidden bg-gray-50 border-t border-gray-200 py-12 sm:py-16 md:py-24">
      {/* Thin decorative arcs behind the panel */}
      <div className="pointer-events-none absolute -left-40 top-24 h-[36rem] w-[36rem] rounded-full border border-[#0F3460]/10" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-24 -top-48 h-[34rem] w-[34rem] rounded-full border border-[#0F3460]/10" aria-hidden="true" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <div className="spotlight relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B2545] via-[#0F3460] to-[#1a5490] text-white">
          {hasPhoto && (
            <>
              {/* Desktop: photo fills the right of the panel */}
              <Image
                ref={imgRef}
                src={PHOTO_SRC}
                alt=""
                width={1600}
                height={814}
                sizes="(min-width: 768px) 40vw, 1px"
                aria-hidden="true"
                onError={() => setHasPhoto(false)}
                className="absolute inset-y-0 right-0 hidden md:block h-full w-[58%] object-cover object-[45%_center]"
                style={{ maskImage: FADE_LEFT, WebkitMaskImage: FADE_LEFT }}
              />
              {/* Mobile: photo as a banner above the copy */}
              <Image
                src={PHOTO_SRC}
                alt=""
                width={1600}
                height={814}
                sizes="(min-width: 768px) 1px, 100vw"
                aria-hidden="true"
                className="md:hidden h-56 w-full object-cover object-[50%_35%]"
                style={{ maskImage: FADE_BOTTOM, WebkitMaskImage: FADE_BOTTOM }}
              />
            </>
          )}

          {/* COPY */}
          <div className={`relative z-10 px-6 pb-10 sm:px-10 sm:pb-14 md:py-24 md:max-w-[55%] ${hasPhoto ? '-mt-10 md:mt-0' : 'pt-10 sm:pt-14'}`}>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-[1.05] tracking-tight">
              Give your <RotatingWord /> the reach it deserves
              <span className="block text-emerald-300">with RankBid</span>
            </h2>
            <Link
              href="/signup"
              className="mt-8 inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 bg-white text-[#0F3460] font-black text-sm rounded-xl shadow-lg shadow-black/20 hover:-translate-y-0.5 transition-all"
            >
              Join now →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
