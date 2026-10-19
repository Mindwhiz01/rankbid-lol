'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import PageHero from '@/components/PageHero';
import { SUPPORT_EMAIL } from '@/lib/site';

const SECTIONS: { id: string; title: string; body: ReactNode }[] = [
  {
    id: 'about',
    title: 'What RankBid Is',
    body: (
      <p>
        RankBid is a community-driven discovery platform. Makers submit products and profiles for free, and
        the community decides the rankings by voting. There are no hidden algorithms: more votes means a higher rank.
      </p>
    ),
  },
  {
    id: 'accounts',
    title: 'Accounts & Voting',
    body: (
      <ul>
        <li>You need an account to submit products and to vote on the leaderboard. Through a product&apos;s support link, anyone can vote once with their name and email, no account needed.</li>
        <li>Each person may vote once per product. Using multiple accounts, bots or paid votes is not allowed.</li>
        <li>Inflating click counts with bots, scripts or click farms is not allowed.</li>
        <li>You are responsible for activity on your account and for keeping your login secure.</li>
      </ul>
    ),
  },
  {
    id: 'listings',
    title: 'Listings & Content',
    body: (
      <>
        <p>Your listing must point to a real, working product or profile, with an accurate title, description and category. By submitting, you confirm you have the right to represent it, and you allow us to display its title, description, logo and link on RankBid and in promotional material.</p>
        <p>Prohibited: chat/group invite links, adult content, URL shorteners, phishing or malware, scams, counterfeit or illegal products. Full details are in our <Link href="/rules">Rules & Guidelines</Link>.</p>
      </>
    ),
  },
  {
    id: 'rankings',
    title: 'Rankings',
    body: (
      <ul>
        <li><strong>All-time</strong> rankings are based on total votes.</li>
        <li><strong>Today</strong> rankings are based on votes from the last 24 hours, and daily top products are saved to the Archive.</li>
        <li>We may remove votes we believe are fraudulent, which can change rankings.</li>
      </ul>
    ),
  },
  {
    id: 'premium',
    title: 'Sponsored Spots & Payments',
    body: (
      <ul>
        <li>Sponsored listings are optional and shown in a labeled Sponsored section separate from the vote leaderboard. Buying one does not add votes or change your leaderboard rank.</li>
        <li>You choose the amount you pay, from $1 in whole US dollars. Sponsored listings are ranked by amount paid, highest first; on equal amounts the one paid first ranks higher. The top 10 are shown on the homepage and all are shown on the Sponsored page.</li>
        <li>Your rank can go down when someone pays more, and up when listings above you are removed or replaced. A change in rank, including leaving the homepage top 10, is not grounds for a refund.</li>
        <li>A sponsored listing is a one-time payment and stays live for the lifetime of the product&rsquo;s listing on RankBid, from when payment is confirmed. It has no end date, but it ends if the listing is removed for breaking these Terms or the payment is refunded or disputed. Paying again for the same product replaces its current sponsored listing.</li>
        <li>Payments are processed by Stripe in US dollars. The price is shown before you pay.</li>
        <li>Once a sponsored listing is active, payment is final and non-refundable, except where required by law.</li>
        <li>You are responsible for any taxes or fees in your jurisdiction.</li>
      </ul>
    ),
  },
  {
    id: 'removal',
    title: 'Removal & Bans',
    body: (
      <p>
        We may remove any listing or suspend any account that breaks these terms or our rules, manipulates rankings,
        uses misleading information or is involved in illegal activity. Sponsored spot fees are not refunded for listings
        removed for violations.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'No Guarantees & Liability',
    body: (
      <p>
        RankBid is provided &ldquo;as is&rdquo;. A ranking or sponsored spot does not guarantee traffic, users or sales. We are
        not liable for indirect or consequential damages, and our total liability is limited to the amount you paid us
        in the last 30 days.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to These Terms',
    body: <p>We may update these terms. Changes take effect when posted, and continued use of RankBid means you accept them.</p>,
  },
];

export default function ToSPage() {
  return (
    <>
      <Header />
      <div className="bg-white min-h-screen">
        <PageHero title="Terms of Service" subtitle="Last updated: October 2026" />

        <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-10 md:py-12 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 lg:gap-10">
          {/* Table of contents */}
          <nav className="hidden lg:block">
            <div className="sticky top-36 border-l-2 border-gray-200 pl-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#1F2937]/40 mb-3">On this page</p>
              <ol className="space-y-2">
                {SECTIONS.map((s, i) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="text-xs font-semibold text-[#1F2937]/70 hover:text-[#0F3460] transition-colors">
                      {i + 1}. {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>

          <div className="divide-y divide-gray-200">
            {SECTIONS.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-36 py-6 sm:py-8 first:pt-0">
                <h2 className="text-base sm:text-lg font-black text-[#1F2937] mb-2 sm:mb-3 flex items-center gap-2.5">
                  <span className="text-sm font-black text-[#0F3460]/35 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  {s.title}
                </h2>
                <div className="text-sm sm:text-[15px] text-[#1F2937]/75 leading-relaxed space-y-2 [&_ul]:space-y-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-[#0F3460] [&_a]:font-semibold [&_a:hover]:underline [&_strong]:text-[#1F2937]">
                  {s.body}
                </div>
              </section>
            ))}

            <section className="!border-t-0 mt-4 bg-gradient-to-r from-[#0F3460] to-[#1a5490] rounded-2xl p-5 sm:p-7 text-white">
              <h2 className="text-base sm:text-lg font-black mb-1">Questions about these terms?</h2>
              <p className="text-xs sm:text-sm text-white/80">
                Email us at <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-white underline underline-offset-2">{SUPPORT_EMAIL}</a>. By using RankBid you agree to these terms.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
