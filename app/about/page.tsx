'use client';

import Link from 'next/link';
import Header from '@/components/Header';
import PageHero from '@/components/PageHero';
import { PremiumIcons } from '@/components/PremiumIcons';

const STEPS = [
  { title: 'Submit your product', text: 'Paste your website or social profile link and pick a category.' },
  { title: 'Share your support link', text: 'Friends and fans vote with just a name and email.' },
  { title: 'Get discovered', text: 'Climb the live rankings and reach real users worldwide.' },
];

const VALUES = [
  { icon: <PremiumIcons.Gift />, title: '100% free', text: 'No submission fees and no hidden costs.' },
  { icon: <PremiumIcons.Eye />, title: 'Fully transparent', text: 'Votes, clicks and sponsored bids are public and live.' },
  { icon: <PremiumIcons.Scale />, title: 'Fair competition', text: 'The leaderboard comes from votes. Sponsored spots are labeled.' },
  { icon: <PremiumIcons.Globe />, title: 'Real audience', text: 'Product fans and makers from around the world.' },
  { icon: <PremiumIcons.Pulse />, title: 'Real-time results', text: 'Watch your ranking change as votes come in.' },
  { icon: <PremiumIcons.Heart />, title: 'Community first', text: 'Built to help makers support each other.' },
];

export default function AboutPage() {
  return (
    <>
      <Header />
      <div className="bg-white text-[#1F2937]">
        <PageHero
          title="About RankBid"
          subtitle="A community-driven discovery platform where makers compete fairly and real people decide what rises."
        />

        {/* Mission: a statement, not a card */}
        <section className="py-14 sm:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.18em] text-[#059669] mb-4">Our mission</p>
            <p className="text-xl sm:text-3xl md:text-4xl font-black leading-snug tracking-tight">
              Help every maker get discovered on merit, with rankings decided by{' '}
              <span className="text-[#0F3460]">transparent community votes</span>, not algorithms or gatekeepers.
            </p>
          </div>
        </section>

        {/* How it works: numbered list with a rule between steps */}
        <section className="pb-14 sm:pb-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <h2 className="text-lg sm:text-2xl font-black mb-6 sm:mb-8">How it works</h2>
            <ol className="divide-y divide-gray-200 border-y border-gray-200">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex items-start gap-4 sm:gap-8 py-5 sm:py-6">
                  <span className="text-3xl sm:text-5xl font-black text-[#0F3460]/15 leading-none w-10 sm:w-16 flex-shrink-0">0{i + 1}</span>
                  <div>
                    <h3 className="text-base sm:text-lg font-black">{step.title}</h3>
                    <p className="text-sm text-[#1F2937]/65 mt-1">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-sm text-[#1F2937]/65">
              New here? Read the <Link href="/faq" className="font-bold text-[#0F3460] underline underline-offset-2">RankBid FAQ</Link>, the{' '}
              <Link href="/rules" className="font-bold text-[#0F3460] underline underline-offset-2">voting rules</Link>, or{' '}
              <Link href="/categories" className="font-bold text-[#0F3460] underline underline-offset-2">browse products by category</Link>.
            </p>
          </div>
        </section>

        {/* Values: open icon grid */}
        <section className="py-14 sm:py-20 bg-gray-50 border-y border-gray-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="text-lg sm:text-2xl md:text-3xl font-black mb-8 sm:mb-12 text-center">What we stand for</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-8 sm:gap-y-10">
              {VALUES.map(v => (
                <div key={v.title} className="flex items-start gap-3.5">
                  <span className="w-10 h-10 rounded-xl bg-white border border-gray-200 text-[#0F3460] flex items-center justify-center flex-shrink-0 shadow-sm">{v.icon}</span>
                  <div>
                    <h3 className="text-sm sm:text-base font-black">{v.title}</h3>
                    <p className="text-xs sm:text-sm text-[#1F2937]/65 mt-0.5">{v.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>
    </>
  );
}
