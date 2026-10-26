'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import PageHero from '@/components/PageHero';
import { SUPPORT_EMAIL } from '@/lib/site';

const SECTIONS: { id: string; title: string; body: ReactNode }[] = [
  {
    id: 'collect',
    title: 'Information We Collect',
    body: (
      <ul>
        <li><strong>Account details:</strong> your name, email address and password (stored hashed), or your Google profile name and email if you sign in with Google.</li>
        <li><strong>Listings:</strong> the product or profile title, description, category, logo, link and any founder information you submit.</li>
        <li><strong>Votes:</strong> which products you voted for. Guest votes from a shared support link also store the name, email and support type you enter.</li>
        <li><strong>Waitlist:</strong> the email address you sign up with.</li>
        <li><strong>Usage data:</strong> pages visited, a visitor session ID, your IP address and browser user agent, used to count visitors and stop vote abuse.</li>
        <li><strong>Clicks:</strong> when you open a product, we count one click. To avoid counting the same visitor twice, we keep a salted hash of your IP address (not the address itself) for up to a day.</li>
        <li><strong>Payments:</strong> for sponsored spots, card details are entered with Stripe. We receive a confirmation and the amount, not your card details. We also store the founder name, email, phone and links you enter when buying a spot.</li>
      </ul>
    ),
  },
  {
    id: 'use',
    title: 'How We Use It',
    body: (
      <ul>
        <li>To run RankBid: show listings, count votes and keep rankings accurate.</li>
        <li>To keep you signed in and secure your account.</li>
        <li>To detect fraud such as duplicate accounts, bots or paid votes.</li>
        <li>To process sponsored spots and contact you about them.</li>
        <li>To send product or launch updates if you joined the waitlist. You can ask us to stop at any time.</li>
      </ul>
    ),
  },
  {
    id: 'public',
    title: 'What Is Public',
    body: (
      <p>
        Listing content you submit (title, description, logo and link), vote and click counts, and on sponsored spots the bid
        amount, founder name and founder social links, are shown publicly (on the site and in its public listings data). Founder email addresses and phone numbers are never shown. We never publish voters&rsquo; email addresses.
      </p>
    ),
  },
  {
    id: 'sharing',
    title: 'Sharing',
    body: (
      <>
        <p>We do not sell your personal data. We share it only with the services that help us run RankBid:</p>
        <ul>
          <li>Supabase (database and storage) and Vercel (hosting).</li>
          <li>Google, if you choose to sign in with Google.</li>
          <li>Stripe, when you buy a sponsored spot.</li>
        </ul>
        <p>We may also disclose information if required by law.</p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies & Local Storage',
    body: (
      <p>
        We use a small number of essential cookies and browser storage to keep you signed in and remember your
        preferences. We don&rsquo;t use advertising cookies. See our <Link href="/cookies">Cookie Policy &amp; Settings</Link> for the full list.
      </p>
    ),
  },
  {
    id: 'retention',
    title: 'How Long We Keep It',
    body: (
      <p>
        We keep account, listing and vote data while your account is active. Visitor session data is kept only as long
        as needed for analytics and abuse prevention. When you delete your account we remove your personal data, except
        records we must keep for legal or payment reasons.
      </p>
    ),
  },
  {
    id: 'rights',
    title: 'Your Rights',
    body: (
      <p>
        You can ask to see, correct, export or delete your personal data, or to be removed from the waitlist. Email us at{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we&rsquo;ll respond within 30 days.
      </p>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    body: (
      <p>
        Passwords are hashed, sign-in cookies are HTTP-only, and traffic is encrypted over HTTPS. No system is perfectly
        secure, so please use a strong, unique password.
      </p>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: <p>RankBid is not intended for children under 13, and we do not knowingly collect their data.</p>,
  },
  {
    id: 'changes',
    title: 'Changes to This Policy',
    body: <p>We may update this policy. Changes take effect when posted, and the date at the top shows the latest version.</p>,
  },
];

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <div className="bg-gray-50 min-h-screen">
        <PageHero title="Privacy Policy" subtitle="Last updated: October 2026" />

        <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-10 md:py-12 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 lg:gap-10">
          {/* Table of contents */}
          <nav className="hidden lg:block">
            <div className="sticky top-36 bg-white border border-gray-200 rounded-xl shadow-sm p-4">
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

          <div className="space-y-3 sm:space-y-4">
            {SECTIONS.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-36 bg-white border border-gray-200 shadow-sm rounded-xl p-4 sm:p-6">
                <h2 className="text-base sm:text-lg font-black text-[#1F2937] mb-2 sm:mb-3 flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-[#0F3460] text-white text-xs font-black flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  {s.title}
                </h2>
                <div className="text-xs sm:text-sm text-[#1F2937]/75 leading-relaxed space-y-2 [&_ul]:space-y-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-[#0F3460] [&_a]:font-semibold [&_a:hover]:underline [&_strong]:text-[#1F2937]">
                  {s.body}
                </div>
              </section>
            ))}

            <section className="bg-gradient-to-r from-[#0F3460] to-[#1a5490] rounded-xl p-4 sm:p-6 text-white">
              <h2 className="text-base sm:text-lg font-black mb-1">Questions about your data?</h2>
              <p className="text-xs sm:text-sm text-white/80">
                Email us at <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-white underline underline-offset-2">{SUPPORT_EMAIL}</a>. See also our <Link href="/tos" className="font-bold text-white underline underline-offset-2">Terms of Service</Link>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
