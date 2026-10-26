import Link from 'next/link';
import Header from '@/components/Header';
import PageHero from '@/components/PageHero';
import JsonLd from '@/components/JsonLd';
import { FAQS } from '@/lib/faqs';
import { SUPPORT_EMAIL } from '@/lib/site';
import { breadcrumbSchema, faqSchema, pageMetadata } from '@/lib/seo';

// Bump when the answers in lib/faqs.ts change.
const LAST_UPDATED = '2026-10-08';

export const metadata = pageMetadata({
  title: 'FAQ: How RankBid Voting & Rankings Work',
  description: 'Answers to common questions about RankBid: is it free, how voting and rankings work, what you can submit, sponsored spots, clicks and how to get more votes.',
  path: '/faq',
});

export default function FaqPage() {
  return (
    <>
      <JsonLd data={[faqSchema(FAQS), breadcrumbSchema([{ name: 'FAQ', path: '/faq' }])]} />
      <Header />
      <div className="bg-white text-[#1F2937]">
        <PageHero
          title="Frequently Asked Questions"
          subtitle="Everything makers and voters ask about RankBid, the free community-voted product leaderboard."
        />

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <p className="text-xs text-[#1F2937]/70 mb-8">
            Last updated <time dateTime={LAST_UPDATED}>{new Date(LAST_UPDATED).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</time>
          </p>

          <div className="divide-y divide-gray-200 border-y border-gray-200">
            {FAQS.map(faq => (
              <section key={faq.q} className="py-6 sm:py-7">
                <h2 className="text-base sm:text-lg font-black text-[#0B2545] mb-2">{faq.q}</h2>
                <p className="text-sm sm:text-[15px] leading-relaxed text-[#1F2937]/75">{faq.a}</p>
              </section>
            ))}
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm font-bold">
            <Link href="/#submit" className="rounded-xl bg-[#0F3460] text-white px-4 py-3 text-center hover:bg-[#0D2A50] transition-colors">Submit a product free</Link>
            <Link href="/categories" className="rounded-xl border border-gray-200 px-4 py-3 text-center hover:bg-gray-50 transition-colors">Browse categories</Link>
            <Link href="/rules" className="rounded-xl border border-gray-200 px-4 py-3 text-center hover:bg-gray-50 transition-colors">Read the rules</Link>
          </div>

          <p className="mt-8 text-sm text-[#1F2937]/65">
            Still have a question? Email <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-[#0F3460] underline underline-offset-2">{SUPPORT_EMAIL}</a>.
          </p>
        </div>
      </div>
    </>
  );
}
