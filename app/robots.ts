import type { MetadataRoute } from 'next';
import { INDEXABLE, SITE_URL } from '@/lib/site';

// Private and utility paths; everything else is open to crawlers.
const DISALLOW = ['/api/', '/admin', '/profile', '/login', '/signup', '/forgot-password', '/reset-password', '/payment-success', '/search'];

// AI search, answer-engine and user-triggered fetchers are allowed explicitly so a stale
// default never blocks them. A bot that matches its own group ignores the '*' group,
// so each one repeats the same disallow list.
const AI_BOTS = [
  'OAI-SearchBot', 'ChatGPT-User', 'GPTBot',
  'Claude-SearchBot', 'Claude-User', 'ClaudeBot',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Applebot-Extended', 'Bingbot', 'DuckAssistBot', 'meta-externalagent', 'CCBot',
];

export default function robots(): MetadataRoute.Robots {
  // Previews (the sandbox) stay crawlable so search engines can see their noindex tag and drop them;
  // a Disallow would hide the tag and leave the bare URLs indexable.
  if (!INDEXABLE) return { rules: [{ userAgent: '*', allow: '/' }] };
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: DISALLOW },
      { userAgent: AI_BOTS, allow: '/', disallow: DISALLOW },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
