// llms.txt (https://llmstxt.org): a Markdown map of the site for LLMs and AI agents.
// Uses the same brand description as the metadata and JSON-LD so positioning stays consistent.
import { CATEGORIES, categoryPath, getCategoryLabel } from '@/lib/categories';
import { getRankedListings } from '@/lib/server/listings';
import { SITE_DESCRIPTION, absoluteUrl } from '@/lib/seo';
import { SUPPORT_EMAIL, X_URL } from '@/lib/site';
import { FAQS } from '@/lib/faqs';

export const revalidate = 3600;

export async function GET() {
  const top = (await getRankedListings()).filter(l => l.totalVotes > 0).slice(0, 20);
  const link = (label: string, path: string, note?: string) => `- [${label}](${absoluteUrl(path)})${note ? `: ${note}` : ''}`;

  const body = [
    '# RankBid',
    '',
    `> ${SITE_DESCRIPTION}`,
    '',
    'Key facts:',
    '- Submitting a product and voting are free.',
    '- Each person gets one vote per product; rankings are ordered by total votes, ties go to the product that was submitted first.',
    '- Rankings update in real time: an all-time board, a "today" board (last 24 hours) and one board per category.',
    '- Anyone can vote through a product\'s shareable support link with just a name and email, no account needed.',
    '- Optional sponsored listings: from $1 with no end date (one payment, live for the lifetime of the listing), ranked by amount paid (ties go to whoever paid first). The top 10 show above the leaderboard on the homepage; all are on /sponsored. Sponsored listings never change vote rankings.',
    '- Every listing shows a click count: RankBid page opens and website visits, one per visitor per product every 30 minutes.',
    '- Listings can be websites or creator profiles on X (Twitter), LinkedIn, Instagram, TikTok or Facebook.',
    '',
    '## Product',
    link('Home: live rankings and submit form', '/', 'Top products by community votes and the free submission form'),
    link('Why RankBid', '/why', 'How launching on RankBid works for makers and voters'),
    link('FAQ', '/faq', 'Answers about voting, ranking, pricing and submissions'),
    link('Rules & guidelines', '/rules', 'Listing requirements, fair-play rules and banned content'),
    link('About', '/about', 'Mission and values'),
    '',
    '## Rankings',
    link('Leaderboard', '/leaderboard', 'All-time top products by total community votes'),
    link('Today', '/today', 'Trending products by votes in the last 24 hours'),
    link('Daily launches', '/daily', 'Products launched today, ranked by votes'),
    link('Archive', '/archive', 'Past daily winners'),
    link('Stats', '/stats', 'Live platform statistics'),
    '',
    '## Rankings by category',
    ...CATEGORIES.map(c => link(`${getCategoryLabel(c)} products`, categoryPath(c))),
    link('Rankings by platform', '/platforms', 'Websites, X, LinkedIn, Instagram, TikTok and Facebook profiles'),
    '',
    ...(top.length
      ? ['## Current top products', ...top.map((l, i) => link(`#${i + 1} ${l.title.replace(/[[\]]/g, '')}`, `/product/${l.id}`, `${getCategoryLabel(l.category)}, ${l.totalVotes} ${l.totalVotes === 1 ? 'vote' : 'votes'}`)), '']
      : []),
    '## FAQ',
    ...FAQS.flatMap(f => [`### ${f.q}`, f.a, '']),
    '## Optional',
    link('Terms of Service', '/tos'),
    link('Privacy Policy', '/privacy'),
    `- Contact: ${SUPPORT_EMAIL}`,
    `- X (Twitter): ${X_URL}`,
    '',
  ].join('\n');

  return new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
}
