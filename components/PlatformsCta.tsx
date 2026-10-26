'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface Row {
  name: string;
  votes: number;
}

const START_ROWS: Row[] = [
  { name: 'Ayesha Khan', votes: 1284 },
  { name: 'Lahore Eats', votes: 972 },
  { name: 'Ali Raza', votes: 815 },
  { name: 'Studio Noor', votes: 640 },
];

// Vertical distance between ranking rows in the phone (row height + gap), in px.
const ROW_STEP = 48;
const TICK_MS = 2200;
const MEDALS = ['🥇', '🥈', '🥉'];

const fmt = (n: number) => n.toLocaleString('en-US');

// A live-looking leaderboard: every tick one profile gets votes, and now and
// then enough to overtake the one above it, so the rows slide past each other.
function useLiveRanking(active: boolean) {
  const [state, setState] = useState<{ rows: Row[]; bumped: { name: string; climbed: boolean } | null }>({
    rows: START_ROWS,
    bumped: null,
  });

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      // Roll the dice outside the updater so it stays pure.
      // Lower ranks get votes more often, which keeps the order moving.
      const pick = Math.random() ** 0.6;
      const overtake = Math.random() < 0.45;
      const extra = 8 + Math.floor(Math.random() * 40);
      setState(({ rows }) => {
        const i = Math.min(rows.length - 1, Math.floor(pick * rows.length));
        const row = rows[i];
        const above = rows[i - 1];
        const gain = above && overtake ? above.votes - row.votes + extra : extra;
        const next = rows
          .map(r => (r.name === row.name ? { ...r, votes: r.votes + gain } : r))
          .sort((a, b) => b.votes - a.votes);
        const climbed = next.findIndex(r => r.name === row.name) < i;
        return { rows: next, bumped: { name: row.name, climbed } };
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [active]);

  return state;
}

// Closing call-to-action for the platforms page: copy on the left, a phone
// mockup of RankBid's mobile view with a live ranking on the right.
export default function PlatformsCta() {
  const mockupRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  // Only animate while the mockup is on screen, and never for reduced motion.
  useEffect(() => {
    const el = mockupRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const { rows, bumped } = useLiveRanking(active);
  const totalVotes = rows.reduce((sum, r) => sum + r.votes, 0);

  return (
    <section className="bg-gray-50 pt-10 sm:pt-16 md:pt-24 pb-10 sm:pb-14 md:pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="spotlight relative rounded-3xl bg-gradient-to-br from-[#0B2545] via-[#0F3460] to-[#1a5490] text-white">
          <div className="grid md:grid-cols-2 items-center">
            {/* COPY */}
            <div className="relative z-10 px-6 py-10 sm:px-10 sm:py-14 md:py-16">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black leading-[1.1] tracking-tight">
                Ready to get your profile
                <span className="block text-emerald-300">ranked?</span>
              </h2>
              <p className="mt-4 text-sm sm:text-base text-white/75 leading-relaxed max-w-md">
                Join creators and makers on Instagram, TikTok, LinkedIn, X and more. Submit your profile free and start climbing with real community votes today!
              </p>
              <Link
                href="/#submit"
                className="mt-7 inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 bg-white text-[#0F3460] font-black text-sm rounded-xl shadow-lg shadow-black/20 hover:-translate-y-0.5 transition-all"
              >
                Submit your profile →
              </Link>
            </div>

            {/* MOCKUP */}
            <div ref={mockupRef} className="relative hidden md:block h-full min-h-[320px]" aria-hidden="true">
              {/* Phone on the right, tilted, overflowing the top and bottom of the panel */}
              <div className="absolute right-8 lg:right-16 -top-20 -bottom-10 z-10 w-[236px] rotate-[8deg]">
                {/* Side buttons: action, volume up/down, power */}
                <span className="absolute -left-[3px] top-24 h-6 w-[3px] rounded-l bg-[#3a3a3f]" />
                <span className="absolute -left-[3px] top-36 h-11 w-[3px] rounded-l bg-[#3a3a3f]" />
                <span className="absolute -left-[3px] top-[12.75rem] h-11 w-[3px] rounded-l bg-[#3a3a3f]" />
                <span className="absolute -right-[3px] top-40 h-16 w-[3px] rounded-r bg-[#3a3a3f]" />

                {/* Metal frame → black bezel → screen */}
                <div className="h-full rounded-[2.6rem] bg-gradient-to-b from-[#4a4a50] via-[#1c1c1f] to-[#4a4a50] p-[3px] shadow-2xl shadow-black/50">
                  <div className="h-full rounded-[2.45rem] bg-black p-[6px]">
                    <div className="relative flex h-full flex-col overflow-hidden rounded-[2.1rem] bg-white">
                      {/* Dynamic island with camera */}
                      <div className="absolute left-1/2 top-2 flex h-[22px] w-[76px] -translate-x-1/2 items-center justify-end rounded-full bg-black pr-2">
                        <span className="h-2 w-2 rounded-full bg-[#1a1f3a] ring-1 ring-[#2c3355]" />
                      </div>

                      {/* Status bar */}
                      <div className="flex h-9 items-center justify-between px-5 pt-1 text-[10px] font-semibold text-[#1F2937]">
                        <span>9:41</span>
                        <span className="flex items-center gap-1">
                          <svg viewBox="0 0 16 10" className="h-2 w-3.5" fill="currentColor">
                            <rect x="0" y="7" width="3" height="3" rx="0.5" />
                            <rect x="4.3" y="5" width="3" height="5" rx="0.5" />
                            <rect x="8.6" y="2.5" width="3" height="7.5" rx="0.5" />
                            <rect x="12.9" y="0" width="3" height="10" rx="0.5" />
                          </svg>
                          <svg viewBox="0 0 14 10" className="h-2 w-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                            <path d="M1 3.5a9 9 0 0 1 12 0M3.3 6a5.5 5.5 0 0 1 7.4 0" />
                            <circle cx="7" cy="8.6" r="0.9" fill="currentColor" stroke="none" />
                          </svg>
                          <span className="flex items-center">
                            <span className="flex h-[9px] w-[18px] items-center rounded-[3px] border border-current p-[1px]">
                              <span className="h-full w-[75%] rounded-[1px] bg-current" />
                            </span>
                            <span className="ml-[1px] h-[3px] w-[1.5px] rounded-r bg-current" />
                          </span>
                        </span>
                      </div>

                      {/* RankBid's mobile home view */}
                      <div className="flex-1 bg-gray-50 text-[#1F2937]">
                        <div className="flex items-center justify-between border-b border-gray-100 bg-white px-3 py-2">
                          <svg viewBox="0 0 16 12" className="h-2.5 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                            <path d="M1 1h14M1 6h14M1 11h14" />
                          </svg>
                          <Image src="/brand/logo-horizontal.png" alt="RankBid" width={823} height={194} sizes="70px" className="h-4 w-auto" />
                          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                            <circle cx="7" cy="7" r="5" />
                            <path d="M11 11l4 4" />
                          </svg>
                        </div>

                        <div className="px-3 pt-3 text-center">
                          <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[8px] text-gray-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {rows.length} profiles · <span className="tabular-nums">{fmt(totalVotes)}</span> votes
                          </span>
                          <p className="mt-2 text-[17px] font-black leading-[1.1] tracking-tight text-[#0F3460]">
                            Ranked by people.
                            <span className="block text-gray-300">Not algorithms.</span>
                          </p>
                          <div className="mt-2 inline-flex rounded-full border border-gray-200 bg-white p-0.5 text-[8px] font-bold">
                            <span className="rounded-full bg-[#0F3460] px-2.5 py-1 text-white">All Time</span>
                            <span className="px-2.5 py-1 text-gray-500">Today</span>
                          </div>
                          <p className="mt-1.5 flex items-center justify-center gap-1 text-[8px] font-semibold text-gray-500">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                            Live
                          </p>
                        </div>

                        <div className="relative mx-3 mt-2" style={{ height: rows.length * ROW_STEP - 6 }}>
                          {rows.map((row, i) => {
                            const leader = i === 0;
                            const isBumped = bumped?.name === row.name;
                            const climbed = isBumped && bumped.climbed;
                            return (
                              <div
                                key={row.name}
                                className={`absolute inset-x-0 top-0 flex h-[42px] items-center gap-2 rounded-xl border px-2.5 shadow-sm transition-[transform,background-color,border-color,color] duration-700 ease-out ${
                                  leader
                                    ? `border-transparent bg-[#0F3460] text-white ${climbed ? 'ring-2 ring-emerald-300' : ''}`
                                    : climbed
                                      ? 'z-10 border-emerald-200 bg-emerald-50'
                                      : 'border-gray-100 bg-white'
                                }`}
                                style={{ transform: `translateY(${i * ROW_STEP}px)` }}
                              >
                                <span className="w-5 text-center text-sm leading-none">
                                  {MEDALS[i] ?? <span className="text-[9px] font-black text-gray-400">#{i + 1}</span>}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[10px] font-bold">{row.name}</span>
                                  <span className={`block text-[8px] ${leader ? 'text-white/60' : 'text-gray-400'}`}>Instagram</span>
                                </span>
                                <span className="text-right leading-none">
                                  <span className={`block text-xs font-black tabular-nums transition-colors duration-700 ${
                                    leader ? 'text-white' : isBumped ? 'text-emerald-600' : 'text-[#0F3460]'
                                  }`}>
                                    {fmt(row.votes)}
                                  </span>
                                  <span className={`text-[7px] ${leader ? 'text-white/60' : 'text-gray-400'}`}>votes</span>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="mx-auto mb-2 h-1 w-24 rounded-full bg-[#111]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
