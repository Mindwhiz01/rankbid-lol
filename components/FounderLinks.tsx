import { safeExternalUrl } from '@/lib/utils';
import { MAX_SOCIAL_LINKS } from '@/lib/premiumSpots';

/** Founder social fields saved on a sponsored listing (see app/api/premium-listings/checkout). */
export interface FounderSocials {
  premiumPosition?: number | null;
  founderName?: string | null;
  founderWebsite?: string | null;
  founderTwitter?: string | null;
  founderLinkedin?: string | null;
  founderInstagram?: string | null;
  founderFacebook?: string | null;
  founderTiktok?: string | null;
  founderYoutube?: string | null;
  founderGithub?: string | null;
}

interface FounderLink {
  label: string;
  href: string;
  icon: string | 'youtube' | 'github';
}

const handle = (h: string) => encodeURIComponent(h.replace(/^@/, ''));

/** The founder links a sponsored listing shows, in the order the buyer is most likely to care about. */
export function founderLinks(l: FounderSocials): FounderLink[] {
  if (!l.premiumPosition) return [];
  const all: (Omit<FounderLink, 'href'> & { href: string | null })[] = [
    { label: 'Website', icon: '/web.png', href: safeExternalUrl(l.founderWebsite) },
    { label: 'X / Twitter', icon: '/twitter.png', href: l.founderTwitter ? `https://x.com/${handle(l.founderTwitter)}` : null },
    { label: 'LinkedIn', icon: '/linkedin.png', href: safeExternalUrl(l.founderLinkedin) },
    { label: 'Instagram', icon: '/instagram.png', href: l.founderInstagram ? `https://instagram.com/${handle(l.founderInstagram)}` : null },
    { label: 'Facebook', icon: '/facebook.png', href: safeExternalUrl(l.founderFacebook) },
    { label: 'TikTok', icon: '/tiktok.png', href: l.founderTiktok ? `https://tiktok.com/@${handle(l.founderTiktok)}` : null },
    { label: 'YouTube', icon: 'youtube', href: safeExternalUrl(l.founderYoutube) },
    { label: 'GitHub', icon: 'github', href: l.founderGithub ? `https://github.com/${handle(l.founderGithub)}` : null },
  ];
  return all.filter((s): s is FounderLink => Boolean(s.href)).slice(0, MAX_SOCIAL_LINKS);
}

function Mark({ icon, className }: { icon: FounderLink['icon']; className: string }) {
  if (icon === 'youtube') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <rect x="2" y="5" width="20" height="14" rx="4" fill="#FF0000" />
        <path d="M10 9l5 3-5 3z" fill="#fff" />
      </svg>
    );
  }
  if (icon === 'github') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden fill="#181717">
        <path d="M12 2a10 10 0 00-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.56 9.56 0 015 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0012 2z" />
      </svg>
    );
  }
  return <img src={icon} alt="" className={`${className} object-contain`} />;
}

/** Sidebar card on the product page: the founder's profiles as labelled buttons. */
export function FounderLinksCard({ listing, title }: { listing: FounderSocials; title: string }) {
  const links = founderLinks(listing);
  if (!links.length) return null;
  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-4 sm:p-6">
      <h2 className="text-sm sm:text-base font-black text-[#1F2937]">Connect with the founder</h2>
      {listing.founderName && <p className="text-xs text-[#1F2937]/70 mt-0.5">{listing.founderName}</p>}
      <div className="grid grid-cols-2 gap-2 mt-3">
        {links.map(s => (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${title} on ${s.label}`}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 text-xs font-black text-[#1F2937] hover:border-[#0F3460]/40 hover:bg-[#0F3460]/5 transition"
          >
            <Mark icon={s.icon} className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{s.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

/**
 * Small icon links to the founder's profiles. Sits above a card's stretched link (relative z-10),
 * so clicking an icon opens the profile instead of the product.
 */
export default function FounderLinks({ listing, title, size = 'sm', className = '' }: {
  listing: FounderSocials;
  title: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const links = founderLinks(listing);
  if (!links.length) return null;
  const box = size === 'md' ? 'w-7 h-7 rounded-lg' : 'w-5 h-5 rounded';
  const mark = size === 'md' ? 'w-4 h-4' : 'w-3 h-3';
  return (
    <span className={`relative z-10 inline-flex items-center gap-1 ${className}`}>
      {links.map(s => (
        <a
          key={s.label}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          title={s.label}
          aria-label={`${title} on ${s.label}`}
          className={`${box} bg-white border border-amber-100 flex items-center justify-center hover:border-amber-300 transition`}
        >
          <Mark icon={s.icon} className={mark} />
        </a>
      ))}
    </span>
  );
}
