'use client';

import { safeExternalUrl } from '@/lib/utils';
import VerifiedBadge from './VerifiedBadge';

interface VerifiedListingCardProps {
  listing: {
    id: string;
    title: string;
    url: string;
    totalVotes: number;
    dayVotes?: number;
    category: string;
    platform: string;
  };
  user: {
    id: string;
    name: string | null;
    email: string;
    tier: 'verified' | 'professional';
    phone?: string | null;
    website?: string | null;
    twitter?: string | null;
    linkedin?: string | null;
    instagram?: string | null;
    facebook?: string | null;
    tiktok?: string | null;
    youtube?: string | null;
    github?: string | null;
  };
  position: number;
  onVote: (listingId: string) => void;
  hasVoted: boolean;
}

interface SocialLink {
  icon: string;
  label: string;
  url?: string;
}

const Icons = {
  Heart: () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  Mail: () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Phone: () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  Globe: () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="currentColor" fill="none" strokeWidth="2" />
    </svg>
  ),
  Twitter: () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2s9 5 20 5a9.5 9.5 0 00-9-5.5c4.75 2.25 7-7 7-7s1.1 1 2-3c-.4-.2-.8-.4-1.2-.6z" />
    </svg>
  ),
  Linkedin: () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  ),
  Instagram: () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" fill="white" />
      <circle cx="17.5" cy="6.5" r="1.5" fill="white" />
    </svg>
  ),
  Star: () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
};

export default function VerifiedListingCard({
  listing,
  user,
  position,
  onVote,
  hasVoted,
}: VerifiedListingCardProps) {
  const getSocialLinks = (): SocialLink[] => {
    const links: SocialLink[] = [];

    // Professional users show all socials, Verified users show limited socials
    if (safeExternalUrl(user.website)) links.push({ icon: 'globe', label: 'Website', url: safeExternalUrl(user.website)! });
    if (user.twitter) links.push({ icon: 'twitter', label: 'Twitter', url: `https://twitter.com/${encodeURIComponent(user.twitter.replace('@', ''))}` });
    if (safeExternalUrl(user.linkedin)) links.push({ icon: 'linkedin', label: 'LinkedIn', url: safeExternalUrl(user.linkedin)! });
    if (user.instagram) links.push({ icon: 'instagram', label: 'Instagram', url: `https://instagram.com/${encodeURIComponent(user.instagram.replace('@', ''))}` });
    if (safeExternalUrl(user.facebook)) links.push({ icon: 'facebook', label: 'Facebook', url: safeExternalUrl(user.facebook)! });
    if (user.tiktok) links.push({ icon: 'tiktok', label: 'TikTok', url: `https://tiktok.com/@${encodeURIComponent(user.tiktok.replace('@', ''))}` });
    if (safeExternalUrl(user.youtube)) links.push({ icon: 'youtube', label: 'YouTube', url: safeExternalUrl(user.youtube)! });
    if (user.github) links.push({ icon: 'github', label: 'GitHub', url: `https://github.com/${encodeURIComponent(user.github.replace('@', ''))}` });

    // Professional: show all socials, Verified: show first 4
    if (user.tier === 'verified' && links.length > 4) {
      return links.slice(0, 4);
    }

    return links;
  };

  const socialLinks = getSocialLinks();
  const tierColors = {
    verified: {
      gradient: 'from-blue-50 via-blue-100 to-cyan-100',
      border: 'border-blue-400',
      badge: 'bg-blue-600 text-white border-blue-600',
      button: 'bg-blue-600 text-white hover:bg-blue-700',
      buttonBorder: 'border-blue-600',
    },
    professional: {
      gradient: 'from-purple-50 via-purple-100 to-pink-100',
      border: 'border-purple-400',
      badge: 'bg-purple-600 text-white border-purple-600',
      button: 'bg-purple-600 text-white hover:bg-purple-700',
      buttonBorder: 'border-purple-600',
    },
  };

  const colors = tierColors[user.tier];

  return (
    <a
      href={safeExternalUrl(listing.url) ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className={`block bg-gradient-to-br ${colors.gradient} ${colors.border} shadow-2xl hover:shadow-2xl border-2 p-4 md:p-6 hover:scale-102 transition-all duration-300 group relative overflow-hidden rounded-xl backdrop-blur-sm`}
    >
      {/* Tier Badge */}
      <div className={`absolute top-4 right-4 ${colors.badge} px-4 py-2 border-2 font-black text-xs md:text-sm flex items-center gap-2 rounded-lg shadow-lg`}>
        <Icons.Star />
        {user.tier === 'verified' ? 'VERIFIED' : 'PROFESSIONAL'}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
        {/* Left: Listing Info */}
        <div className="md:col-span-2">
          <div className="flex items-start justify-between gap-2 md:gap-4 mb-4 md:mb-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                <div className={`w-10 md:w-12 h-10 md:h-12 text-white font-black rounded-lg flex items-center justify-center text-lg md:text-xl flex-shrink-0 shadow-lg ${colors.button}`}>
                  #{position}
                </div>
                <div className="min-w-0">
                  <p className="text-base md:text-2xl font-black text-slate-900 group-hover:underline truncate flex items-center gap-2">
                    {listing.title}
                  </p>
                  <p className="text-xs md:text-sm text-slate-600 font-semibold truncate">{listing.category} • {listing.platform}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Vote Count */}
          <div className="mb-4 md:mb-6 bg-white/80 backdrop-blur inline-block px-4 md:px-6 py-3 md:py-4 border-2 border-gray-200 rounded-lg shadow-lg">
            <p className="text-2xl md:text-4xl font-black text-slate-900">
              💗 {listing.totalVotes.toLocaleString('en-US')}
            </p>
            <p className="text-xs md:text-sm text-slate-600 font-bold mt-1">Community Votes</p>
          </div>
        </div>

        {/* Right: User Info & Vote Button */}
        <div className="flex flex-col gap-2 md:gap-4">
          {/* Vote Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              onVote(listing.id);
            }}
            disabled={hasVoted}
            className={`w-full py-3 md:py-4 px-3 md:px-4 font-black text-sm md:text-base border-2 md:border-3 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-lg ${
              hasVoted
                ? 'bg-gray-300 text-gray-600 border-gray-300 cursor-not-allowed opacity-50'
                : `${colors.button} ${colors.buttonBorder} hover:shadow-xl transform`
            }`}
          >
            <Icons.Heart />
            {hasVoted ? 'Voted ✓' : 'Vote Now'}
          </button>

          {/* User Info */}
          <div className="bg-white/95 backdrop-blur p-4 md:p-5 border-2 border-gray-200 rounded-lg shadow-lg">
            <div className="flex items-center gap-2 mb-3 md:mb-4">
              <VerifiedBadge tier={user.tier} size="md" />
              <p className="font-black text-slate-900 text-xs md:text-sm">
                {user.tier === 'verified' ? 'Verified Creator' : '⭐ Professional'}
              </p>
            </div>
            <p className="font-bold text-slate-900 text-sm md:text-base mb-1 md:mb-3 line-clamp-2 break-words">{user.name || user.email}</p>

            <div className="space-y-2 md:space-y-2.5 mb-3 md:mb-4 text-xs md:text-sm">
              {user.email && (
                <a href={`mailto:${user.email}`} className={`flex items-center gap-2 font-semibold transition-all hover:translate-x-1`} style={{color: user.tier === 'verified' ? '#2563eb' : '#9333ea'}}>
                  <Icons.Mail />
                  <span className="truncate min-w-0 hover:underline">{user.email}</span>
                </a>
              )}
              {user.phone && (
                <a href={`tel:${user.phone}`} className={`flex items-center gap-2 font-semibold transition-all hover:translate-x-1`} style={{color: user.tier === 'verified' ? '#2563eb' : '#9333ea'}}>
                  <Icons.Phone />
                  <span className="hover:underline">{user.phone}</span>
                </a>
              )}
            </div>

            {/* Social Links */}
            {socialLinks.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-3 md:pt-4 border-t-2 border-gray-200">
                {socialLinks.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={link.label}
                    className={`p-2 md:p-2.5 rounded-lg border-2 transition-all duration-200 hover:scale-110 hover:shadow-lg ${colors.button} ${colors.buttonBorder}`}
                  >
                    {link.icon === 'globe' && <Icons.Globe />}
                    {link.icon === 'twitter' && <Icons.Twitter />}
                    {link.icon === 'linkedin' && <Icons.Linkedin />}
                    {link.icon === 'instagram' && <Icons.Instagram />}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}
