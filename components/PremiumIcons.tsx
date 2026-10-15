import type { ReactNode } from 'react';

// Duotone feature icons: a soft filled layer (opacity 0.25) under a crisp stroke.
// Render inside <IconTile> for the gradient badge used across marketing sections.

type IconProps = { className?: string };

function Svg({ className = 'w-5 h-5', children }: IconProps & { children: ReactNode }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const PremiumIcons = {
  Globe: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity={0.25} />
      <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
    </Svg>
  ),
  Layers: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3l9 5-9 5-9-5 9-5z" fill="currentColor" fillOpacity={0.25} />
      <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5" />
    </Svg>
  ),
  Calendar: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" fill="currentColor" fillOpacity={0.25} />
      <path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2" />
    </Svg>
  ),
  Pulse: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="16" rx="3" fill="currentColor" fillOpacity={0.25} />
      <path d="M3 12h4l2-5 4 10 2-5h6" />
    </Svg>
  ),
  Portfolio: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="7" width="18" height="13" rx="2.5" fill="currentColor" fillOpacity={0.25} />
      <path d="M9 7V5.5A1.5 1.5 0 0110.5 4h3A1.5 1.5 0 0115 5.5V7M3 12.5h18M10.5 12.5v1.5h3v-1.5" />
    </Svg>
  ),
  Chart: (p: IconProps) => (
    <Svg {...p}>
      <rect x="5" y="11" width="3.5" height="8" rx="1" fill="currentColor" fillOpacity={0.25} />
      <rect x="10.25" y="6" width="3.5" height="13" rx="1" fill="currentColor" fillOpacity={0.25} />
      <rect x="15.5" y="13.5" width="3.5" height="5.5" rx="1" fill="currentColor" fillOpacity={0.25} />
      <path d="M3 21h18M6.75 11v8M12 6v13M17.25 13.5V19" />
    </Svg>
  ),
  Share: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="18" cy="5.5" r="2.5" fill="currentColor" fillOpacity={0.25} />
      <circle cx="6" cy="12" r="2.5" fill="currentColor" fillOpacity={0.25} />
      <circle cx="18" cy="18.5" r="2.5" fill="currentColor" fillOpacity={0.25} />
      <circle cx="18" cy="5.5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="18.5" r="2.5" />
      <path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1" />
    </Svg>
  ),
  Badge: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 2.5l2.4 1.8 3 .1.9 2.8 2.4 1.8-.9 2.9.9 2.8-2.4 1.8-.9 2.8-3 .1L12 21.5l-2.4-1.8-3-.1-.9-2.8-2.4-1.8.9-2.8-.9-2.9 2.4-1.8.9-2.8 3-.1L12 2.5z" fill="currentColor" fillOpacity={0.25} />
      <path d="M12 2.5l2.4 1.8 3 .1.9 2.8 2.4 1.8-.9 2.9.9 2.8-2.4 1.8-.9 2.8-3 .1L12 21.5l-2.4-1.8-3-.1-.9-2.8-2.4-1.8.9-2.8-.9-2.9 2.4-1.8.9-2.8 3-.1L12 2.5zM8.5 12l2.5 2.5 4.5-5" />
    </Svg>
  ),
  Gift: (p: IconProps) => (
    <Svg {...p}>
      <rect x="4" y="11" width="16" height="10" rx="1.5" fill="currentColor" fillOpacity={0.25} />
      <path d="M3 7.5h18V11H3zM4 11v8.5A1.5 1.5 0 005.5 21h13a1.5 1.5 0 001.5-1.5V11M12 7.5V21M12 7.5S10.5 3 8 3.5 7 7.5 12 7.5zM12 7.5S13.5 3 16 3.5s1 4-4 4z" />
    </Svg>
  ),
  Rocket: (p: IconProps) => (
    <Svg {...p}>
      <path d="M14.5 4.5c2.5-1.2 5-1.5 5-1.5s-.3 2.5-1.5 5c-1.4 2.9-4.3 5.6-7 7l-2-2c1.4-2.7 4.1-5.6 5.5-8.5z" fill="currentColor" fillOpacity={0.25} />
      <path d="M14.5 4.5c2.5-1.2 5-1.5 5-1.5s-.3 2.5-1.5 5c-1.4 2.9-4.3 5.6-7 7l-2-2c1.4-2.7 4.1-5.6 5.5-8.5zM9 13l-3.5-.5L8 9h4M11 15l.5 3.5L15 16v-4M5.5 18.5c.5-1.5 1.5-2 2.5-2M15.5 8.5h.01" />
    </Svg>
  ),
  Feedback: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 5.5A2.5 2.5 0 016.5 3h11A2.5 2.5 0 0120 5.5v8a2.5 2.5 0 01-2.5 2.5H9l-5 4V5.5z" fill="currentColor" fillOpacity={0.25} />
      <path d="M4 5.5A2.5 2.5 0 016.5 3h11A2.5 2.5 0 0120 5.5v8a2.5 2.5 0 01-2.5 2.5H9l-5 4V5.5z" />
      <path d="M12 12.5s-3-1.7-3-3.6a1.6 1.6 0 013-.8 1.6 1.6 0 013 .8c0 1.9-3 3.6-3 3.6z" />
    </Svg>
  ),
  Scale: (p: IconProps) => (
    <Svg {...p}>
      <path d="M2.5 14.5h6a3 3 0 01-6 0zM15.5 14.5h6a3 3 0 01-6 0z" fill="currentColor" fillOpacity={0.25} />
      <path d="M12 3v18M7 21h10M4 7h16M5.5 7l-3 7.5h6L5.5 7zM18.5 7l-3 7.5h6L18.5 7zM12 3l-1.5 1.5M12 3l1.5 1.5" />
    </Svg>
  ),
  Eye: (p: IconProps) => (
    <Svg {...p}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" fill="currentColor" fillOpacity={0.25} />
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  ),
  Compass: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity={0.25} />
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
    </Svg>
  ),
  Ballot: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 13h16v6.5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 19.5V13z" fill="currentColor" fillOpacity={0.25} />
      <path d="M4 13h16v6.5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 19.5V13zM2.5 13h19M8 13V4.5A1.5 1.5 0 019.5 3h5A1.5 1.5 0 0116 4.5V13M10 8l1.5 1.5L14 7" />
    </Svg>
  ),
  Bolt: (p: IconProps) => (
    <Svg {...p}>
      <path d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12l1-8z" fill="currentColor" fillOpacity={0.25} />
      <path d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12l1-8z" />
    </Svg>
  ),
  Heart: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 20.5s-8.5-4.8-8.5-11A4.5 4.5 0 0112 7a4.5 4.5 0 018.5 2.5c0 6.2-8.5 11-8.5 11z" fill="currentColor" fillOpacity={0.25} />
      <path d="M12 20.5s-8.5-4.8-8.5-11A4.5 4.5 0 0112 7a4.5 4.5 0 018.5 2.5c0 6.2-8.5 11-8.5 11z" />
    </Svg>
  ),
  Trophy: (p: IconProps) => (
    <Svg {...p}>
      <path d="M7 3.5h10v5a5 5 0 01-10 0v-5z" fill="currentColor" fillOpacity={0.25} />
      <path d="M7 3.5h10v5a5 5 0 01-10 0v-5zM7 5.5H4.5v1.5A3 3 0 007.3 10M17 5.5h2.5v1.5a3 3 0 01-2.8 3M12 13.5v3.5M8.5 20.5h7l-.8-3.5H9.3l-.8 3.5z" />
    </Svg>
  ),
  Inbox: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3.5 13.5l2.6-7.3A2 2 0 018 4.8h8a2 2 0 011.9 1.4l2.6 7.3v4.2a2 2 0 01-2 2h-13a2 2 0 01-2-2v-4.2z" fill="currentColor" fillOpacity={0.25} />
      <path d="M3.5 13.5l2.6-7.3A2 2 0 018 4.8h8a2 2 0 011.9 1.4l2.6 7.3v4.2a2 2 0 01-2 2h-13a2 2 0 01-2-2v-4.2zM3.5 13.5h4.3l1.4 2.5h5.6l1.4-2.5h4.3" />
    </Svg>
  ),
  Shield: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6l8-3z" fill="currentColor" fillOpacity={0.25} />
      <path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6l8-3zM8.5 12l2.5 2.5 4.5-5" />
    </Svg>
  ),
};

const tileTones = {
  navy: 'bg-gradient-to-br from-[#0F3460] to-[#1a5490] shadow-[#0F3460]/25',
  green: 'bg-gradient-to-br from-[#059669] to-[#10B981] shadow-[#059669]/25',
} as const;

const tileSizes = {
  sm: 'w-7 h-7 sm:w-8 sm:h-8 rounded-lg',
  md: 'w-9 h-9 sm:w-11 sm:h-11 rounded-xl',
} as const;

export function IconTile({
  children,
  tone = 'navy',
  size = 'md',
}: {
  children: ReactNode;
  tone?: keyof typeof tileTones;
  size?: keyof typeof tileSizes;
}) {
  return (
    <div className={`${tileSizes[size]} ${tileTones[tone]} text-white flex items-center justify-center flex-shrink-0 shadow-md ring-1 ring-white/20`}>
      {children}
    </div>
  );
}

// Empty-state badge: gradient inbox tile on a soft halo, with a green "+" inviting the first submission.
export function EmptyStateIcon({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'w-12 h-12 sm:w-14 sm:h-14 rounded-2xl' : 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl';
  const icon = size === 'sm' ? 'w-6 h-6 sm:w-7 sm:h-7' : 'w-7 h-7 sm:w-8 sm:h-8';
  return (
    <div className="relative inline-flex">
      <div className="absolute -inset-3 rounded-[1.75rem] bg-gradient-to-br from-[#0F3460]/10 to-[#059669]/10 blur-md" aria-hidden="true" />
      <div className={`relative ${box} bg-gradient-to-br from-[#0F3460] to-[#1a5490] text-white flex items-center justify-center shadow-lg shadow-[#0F3460]/25 ring-1 ring-white/20`}>
        <PremiumIcons.Inbox className={icon} />
      </div>
      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gradient-to-br from-[#059669] to-[#10B981] text-white ring-2 ring-white flex items-center justify-center shadow-md" aria-hidden="true">
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><path d="M12 6v12M6 12h12" /></svg>
      </span>
    </div>
  );
}
