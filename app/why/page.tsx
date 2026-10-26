'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import WhyHero from '@/components/WhyHero';
import { PremiumIcons } from '@/components/PremiumIcons';

const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

const STEPS = [
  { title: 'Submit', text: 'Paste your website or social profile, pick a category. Live in two minutes, no approval queue.' },
  { title: 'Collect votes', text: 'Share your support link. Anyone can vote with just a name and email.' },
  { title: 'Climb the ranks', text: 'More votes, higher rank. All-time, today and every category update live.' },
];

const MAKER_POINTS: { icon: ReactNode; title: string; text: string }[] = [
  { icon: <PremiumIcons.Gift />, title: 'Free, forever', text: 'No listing fees. Submit as many products as you like. Sponsored spots are optional.' },
  { icon: <PremiumIcons.Rocket />, title: 'No gatekeepers', text: 'Your product goes live instantly. No editors, no waiting.' },
  { icon: <PremiumIcons.Scale />, title: 'A fair playing field', text: 'Indie makers compete with big teams on votes, not ad budgets.' },
  { icon: <PremiumIcons.Feedback />, title: 'Honest feedback', text: 'See exactly how real people respond to what you built.' },
];

const VOTER_POINTS: { icon: ReactNode; title: string; text: string }[] = [
  { icon: <PremiumIcons.Compass />, title: 'Discover what’s good', text: 'The leaderboard is ranked by votes. Paid spots are always labeled Sponsored.' },
  { icon: <PremiumIcons.Ballot />, title: 'Your vote matters', text: 'Every vote moves the rankings everyone else sees.' },
  { icon: <PremiumIcons.Pulse />, title: 'Live rankings', text: 'Watch today’s trending products change in real time.' },
  { icon: <PremiumIcons.Heart />, title: 'Back real makers', text: 'Help indie founders and small teams get discovered.' },
];

function PointList({ items }: { items: typeof MAKER_POINTS }) {
  return (
    <ul className="space-y-5 sm:space-y-6">
      {items.map(item => (
        <li key={item.title} className="flex items-start gap-3.5 sm:gap-4">
          <span className="w-10 h-10 rounded-xl bg-[#0F3460]/5 text-[#0F3460] flex items-center justify-center flex-shrink-0">{item.icon}</span>
          <div>
            <h3 className="text-sm sm:text-base font-black text-[#1F2937]">{item.title}</h3>
            <p className="text-xs sm:text-sm text-[#1F2937]/65 leading-relaxed mt-0.5">{item.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function WhyRankBid() {
  return (
    <>
      <Header />
      <div className="bg-white text-[#1F2937] overflow-x-hidden">
        {/* HERO: photo banner with live numbers */}
        <WhyHero />

        {/* HOW IT WORKS: timeline, no cards */}
        <section className="py-14 sm:py-20 md:py-24">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-10 sm:mb-14">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-2 sm:mb-3">How it works</h2>
              <p className="text-sm sm:text-base text-[#1F2937]/70">Three steps from launch to leaderboard.</p>
            </div>

            <ol className="relative grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
              {/* connector line (desktop) */}
              <div className="hidden md:block absolute top-6 left-[16.6%] right-[16.6%] h-0.5 bg-gradient-to-r from-[#0F3460]/20 via-[#0F3460]/40 to-[#059669]/40" aria-hidden="true" />
              {STEPS.map((step, i) => (
                <li key={step.title} className="relative flex md:flex-col items-start md:items-center gap-4 md:gap-0 md:text-center">
                  <span className="relative z-10 w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0F3460] to-[#1a5490] text-white font-black text-lg flex items-center justify-center shadow-lg shadow-[#0F3460]/25 flex-shrink-0 md:mb-5">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-base sm:text-lg font-black mb-1">{step.title}</h3>
                    <p className="text-sm text-[#1F2937]/65 leading-relaxed md:max-w-xs">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* MAKERS & VOTERS: two open columns */}
        <section className="py-14 sm:py-20 bg-gray-50 border-y border-gray-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16">
            <div>
              <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.18em] text-[#059669] mb-2">For makers</p>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black mb-6 sm:mb-8">Launch without asking permission</h2>
              <PointList items={MAKER_POINTS} />
            </div>
            <div>
              <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.18em] text-[#0F3460] mb-2">For the community</p>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black mb-6 sm:mb-8">Find what people actually love</h2>
              <PointList items={VOTER_POINTS} />
            </div>
          </div>
        </section>

        {/* SHOWCASE: one visual */}
        <section className="py-14 sm:py-20 md:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="order-2 lg:order-1">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-3 sm:mb-4">Your rank, everywhere</h2>
              <p className="text-sm sm:text-base text-[#1F2937]/65 leading-relaxed mb-6">
                Every product gets a public page with its live rank, a shareable support link and a rank card made for X, LinkedIn and WhatsApp. Share once and let your community do the rest.
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-[#1F2937]/75">
                <span className="inline-flex items-center gap-2"><PremiumIcons.Globe className="w-5 h-5 text-[#0F3460]" /> Global leaderboard</span>
                <span className="inline-flex items-center gap-2"><PremiumIcons.Layers className="w-5 h-5 text-[#0F3460]" /> Category ranks</span>
                <span className="inline-flex items-center gap-2"><PremiumIcons.Share className="w-5 h-5 text-[#0F3460]" /> One-click sharing</span>
              </div>
            </div>

            {/* Mock rank card */}
            <div className="order-1 lg:order-2 flex justify-center">
              <div className="relative w-full max-w-sm">
                <div className="absolute -inset-4 bg-gradient-to-br from-[#0F3460]/15 to-[#059669]/15 rounded-[2rem] blur-2xl" aria-hidden="true" />
                <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#0B2545] via-[#0F3460] to-[#1a5490] text-white p-6 sm:p-7 shadow-2xl rotate-[-2deg] hover:rotate-0 transition-transform duration-500">
                  <div className="absolute -top-16 -right-12 w-44 h-44 bg-emerald-400/30 rounded-full blur-3xl" aria-hidden="true" />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-7">
                      <img src="/brand/logo-horizontal-white.png" alt="RankBid" width={823} height={194} className="h-6 w-auto" />
                      <span className="ml-auto text-[10px] font-black tracking-wider px-2.5 py-1 rounded-full bg-amber-400 text-[#0B2545]">TOP 3</span>
                    </div>
                    <p className="text-[10px] font-bold tracking-[0.15em] text-white/55 mb-1">PRODUCT</p>
                    <p className="text-2xl font-black mb-6">Your Product</p>
                    <div className="flex items-end justify-between rounded-2xl bg-white/10 border border-white/15 px-5 py-4">
                      <div>
                        <p className="text-[10px] font-bold tracking-[0.15em] text-white/55">RANK</p>
                        <p className="text-4xl font-black text-amber-300 leading-none mt-1">#2</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold tracking-[0.15em] text-white/55">VOTES</p>
                        <p className="text-4xl font-black text-emerald-300 leading-none mt-1">248</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </>
  );
}
