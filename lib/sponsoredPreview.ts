// Dummy sponsored rows for checking the layout: shown only when the homepage URL has ?preview=sponsored.
// Never saved anywhere; clicks on them bump the number on screen but are not counted.
import type { SponsoredListing } from '@/components/SponsoredRow';

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

export function isSponsoredPreview(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'sponsored';
}

export const SPONSORED_PREVIEW: (SponsoredListing & { isPremium: true; platform: string; dayVotes: number })[] = [
  { title: 'Pixelforge · design assets in one click', description: 'Generate icons, mockups and illustrations from a single prompt, ready for Figma.', url: 'https://example.com', category: 'Design', premiumBidUsd: 25, clickCount: 4812, totalVotes: 128, createdAt: ago(32), founderWebsite: 'https://example.com', founderTwitter: 'example', founderLinkedin: 'https://linkedin.com', founderInstagram: 'example' },
  { title: 'Ledgerly · bookkeeping on autopilot', description: 'Connect your bank and get clean books, invoices and tax-ready reports every month.', url: 'https://example.org', category: 'Finance', premiumBidUsd: 14, clickCount: 2290, totalVotes: 64, createdAt: ago(12), founderWebsite: 'https://example.org' },
  { title: 'ShipKit · launch your SaaS this weekend', description: 'Auth, payments, emails and a dashboard, wired up and ready to deploy.', url: 'https://example.net', category: 'Developer', premiumBidUsd: 9, clickCount: 1034, totalVotes: 41, createdAt: ago(5) },
  { title: 'Chai & Code', description: 'Weekly Urdu-language coding lessons for beginners.', url: 'https://example.com/chai', category: 'Education', premiumBidUsd: 6, clickCount: 377, totalVotes: 19, createdAt: ago(2) },
  { title: 'Tripnest · plan trips with friends', description: 'Shared itineraries, split costs and a group chat for every trip.', url: 'https://example.org/trip', category: 'Travel', premiumBidUsd: 4, clickCount: 152, totalVotes: 7, createdAt: ago(1) },
  { title: 'Formly', description: 'Beautiful forms and surveys without code.', url: 'https://example.net/forms', category: 'Productivity', premiumBidUsd: 2, clickCount: 23, totalVotes: 3, createdAt: ago(0) },
  { title: 'Desi Recipes Daily', description: 'One home-style recipe every day.', url: 'https://example.com/recipes', category: 'Other', premiumBidUsd: 1, clickCount: 0, totalVotes: 0, createdAt: ago(0) },
].map((l, i) => ({ ...l, id: `preview-${i + 1}`, premiumPosition: i + 1, isPremium: true as const, platform: 'website', dayVotes: 0 }));
