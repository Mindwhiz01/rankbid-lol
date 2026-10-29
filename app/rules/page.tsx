'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import PageHero from '@/components/PageHero';
import { PremiumIcons } from '@/components/PremiumIcons';
import { SUPPORT_EMAIL } from '@/lib/site';

function RuleCard({ icon, tone = 'navy', title, children }: { icon: ReactNode; tone?: 'navy' | 'green'; title: string; children: ReactNode }) {
  return (
    <section className="py-6 sm:py-8 grid grid-cols-1 sm:grid-cols-[14rem_1fr] gap-3 sm:gap-8">
      <div className="flex items-center sm:items-start gap-3">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${tone === 'green' ? 'bg-[#059669]/10 text-[#059669]' : 'bg-[#0F3460]/5 text-[#0F3460]'}`}>{icon}</span>
        <h2 className="text-base sm:text-lg font-black text-[#1F2937] sm:pt-1">{title}</h2>
      </div>
      <div>{children}</div>
    </section>
  );
}

function List({ items, bad = false }: { items: string[]; bad?: boolean }) {
  return (
    <ul className="space-y-2 sm:space-y-2.5">
      {items.map(item => (
        <li key={item} className="flex items-start gap-2.5 text-xs sm:text-sm text-[#1F2937]/75 leading-relaxed">
          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${bad ? 'bg-red-500' : 'bg-[#0F3460]'}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function RulesPage() {
  return (
    <>
      <Header />
      <div className="bg-white min-h-screen">
        <PageHero title="Rules & Guidelines" subtitle="Simple rules that keep RankBid fair, useful and spam-free for everyone." />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-8 divide-y divide-gray-200">
          <RuleCard icon={<PremiumIcons.Rocket />} title="Listing Requirements">
            <List items={[
              'Your product must have a working, live URL or profile',
              'Use an accurate title and description',
              'Pick the category that best fits your product',
              'One listing per product: no duplicates',
            ]} />
          </RuleCard>

          <RuleCard icon={<PremiumIcons.Ballot />} tone="green" title="How Voting Works">
            <List items={[
              'Submitting and voting are 100% free',
              'Vote with your account, or as a guest with your name and email from a maker’s support link (it counts once you confirm it by email)',
              'Each person gets one vote per product. Makers may vote for their own product once, like everyone else',
              'All-time rankings use total votes; Today uses votes from the last 24 hours',
              'Rankings update in real time as votes come in',
            ]} />
          </RuleCard>

          <RuleCard icon={<PremiumIcons.Shield />} title="Fair Play">
            <p className="text-xs sm:text-sm text-[#1F2937]/75 mb-3">These will get listings removed and accounts banned:</p>
            <List bad items={[
              'Fake accounts, bots or vote buying/trading',
              'Any attempt to manipulate rankings',
              'Bots or scripts that inflate click counts',
              'Fake products or misleading claims',
              'Harassment, hate speech or abuse',
            ]} />
          </RuleCard>

          <RuleCard icon={<PremiumIcons.Eye />} tone="green" title="Banned Content">
            <List bad items={[
              'Chat/group invite links (Discord, Telegram, WhatsApp)',
              'Adult or NSFW content',
              'URL shorteners: use direct links only',
              'Phishing, malware, scams or illegal products',
            ]} />
          </RuleCard>

          <RuleCard icon={<PremiumIcons.Trophy />} title="Sponsored Spots (Optional)">
            <List items={[
              'Optional: the vote leaderboard ranks on votes alone',
              'You choose the price (from $1); sponsored products are ranked by price',
              'Pay more than a listing to rank above it; on equal prices whoever paid first stays ahead',
              'The top 10 show on the homepage; every sponsored product is on the Sponsored page',
              'Pay once: a sponsorship has no end date',
              'Sponsored products follow the same content rules as everyone else',
            ]} />
          </RuleCard>

          <RuleCard icon={<PremiumIcons.Calendar />} tone="green" title="Daily Rankings & Archive">
            <List items={[
              'The Today board covers the last 24 hours of votes',
              'Each day’s top products are saved to the Archive',
              'All-time rankings never reset',
            ]} />
          </RuleCard>

          <section className="!border-t-0 mt-6 sm:mt-10 mb-6 bg-gradient-to-r from-[#0F3460] to-[#1a5490] rounded-2xl p-5 sm:p-7 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-black mb-1">Questions or reporting a violation?</h2>
              <p className="text-xs sm:text-sm text-white/80">We usually reply within a day. See also our <Link href="/tos" className="underline underline-offset-2 hover:text-white">Terms of Service</Link>.</p>
            </div>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex items-center gap-2 px-4 py-2 sm:py-2.5 bg-white text-[#0F3460] font-black text-xs sm:text-sm rounded-lg hover:scale-105 active:scale-95 transition-all flex-shrink-0"
            >
              Contact Support
            </a>
          </section>
        </div>
      </div>
    </>
  );
}
