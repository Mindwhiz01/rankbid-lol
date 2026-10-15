// Checks that a submitted link belongs to the platform picked on the submit form
// (an Instagram link on the Instagram tab, a normal site on the Website tab). Shared by the
// form (instant feedback) and /api/listings/submit (the real check).

export type SocialPlatform = 'twitter' | 'linkedin' | 'facebook' | 'instagram' | 'tiktok';
export type SubmitPlatform = 'website' | SocialPlatform;

const SOCIAL_HOSTS: Record<SocialPlatform, string[]> = {
  twitter: ['twitter.com', 'x.com'],
  linkedin: ['linkedin.com', 'lnkd.in'],
  facebook: ['facebook.com', 'fb.com', 'fb.me'],
  instagram: ['instagram.com', 'instagr.am'],
  tiktok: ['tiktok.com'],
};

export const PLATFORM_LABELS: Record<SubmitPlatform, string> = {
  website: 'Website',
  twitter: 'Twitter/X',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
};

const EXAMPLES: Record<SubmitPlatform, string> = {
  website: 'https://yourproduct.com',
  twitter: 'https://x.com/username',
  linkedin: 'https://linkedin.com/in/yourprofile',
  facebook: 'https://facebook.com/yourpage',
  instagram: 'https://instagram.com/username',
  tiktok: 'https://tiktok.com/@username',
};

/** "an Instagram", "a TikTok". */
const withArticle = (label: string) => `${/^[AEIOU]/.test(label) ? 'an' : 'a'} ${label}`;

export const platformExample = (platform: string) => EXAMPLES[normalizePlatform(platform)];

/** "x" is stored by older listings for Twitter; anything unknown counts as a website. */
export function normalizePlatform(platform: string | null | undefined): SubmitPlatform {
  if (platform === 'x') return 'twitter';
  return platform && platform in PLATFORM_LABELS ? (platform as SubmitPlatform) : 'website';
}

/** True when the text is meant as a link (has a scheme, or a domain like "site.com/..."). */
export function looksLikeUrl(text: string): boolean {
  const t = text.trim();
  return /^https?:\/\//i.test(t) || /^[^\s/@]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(t);
}

/** Lower-case host without "www." / "m.", or null when the text isn't a usable link. */
export function hostOf(text: string): string | null {
  const t = text.trim();
  if (!t || /\s/.test(t)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    const host = url.hostname.toLowerCase().replace(/^(www|m|mobile)\./, '');
    return host.includes('.') && /\.[a-z]{2,}$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

/** Which platform a link belongs to: a social network by its domain, otherwise 'website'. Null if not a link. */
export function detectPlatform(text: string): SubmitPlatform | null {
  const host = hostOf(text);
  if (!host) return null;
  for (const [platform, hosts] of Object.entries(SOCIAL_HOSTS) as [SocialPlatform, string[]][]) {
    if (hosts.some(h => host === h || host.endsWith(`.${h}`))) return platform;
  }
  return 'website';
}

/**
 * Why `text` can't be submitted under `platform`, or null when it's fine.
 * Social tabs also accept a bare handle ("username" or "@username").
 */
export function platformUrlProblem(platform: string, text: string): string | null {
  const picked = normalizePlatform(platform);
  const value = text.trim();
  if (!value) return picked === 'website' ? 'Please enter your product URL' : 'Please enter the profile URL';

  if (picked !== 'website' && !looksLikeUrl(value)) {
    return /^@?[A-Za-z0-9._-]{1,100}$/.test(value)
      ? null
      : `Enter a valid ${PLATFORM_LABELS[picked]} profile link, e.g. ${EXAMPLES[picked]}`;
  }

  const actual = detectPlatform(value);
  if (!actual) {
    return `Enter a valid link, e.g. ${EXAMPLES[picked]}`;
  }
  if (actual === picked) return null;
  if (picked === 'website') {
    return `That's ${withArticle(PLATFORM_LABELS[actual])} link. Pick the ${PLATFORM_LABELS[actual]} tab to submit a profile.`;
  }
  return actual === 'website'
    ? `That isn't ${withArticle(PLATFORM_LABELS[picked])} link. Paste your ${PLATFORM_LABELS[picked]} profile, e.g. ${EXAMPLES[picked]}`
    : `That's ${withArticle(PLATFORM_LABELS[actual])} link, not ${PLATFORM_LABELS[picked]}. Pick the ${PLATFORM_LABELS[actual]} tab or paste your ${PLATFORM_LABELS[picked]} profile.`;
}
