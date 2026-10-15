import type { CSSProperties, ReactNode } from 'react';

interface SelectionHeadingProps {
  /** Light first line, e.g. "top". Optional for one-word titles. */
  lead?: string;
  /** Bold words shown inside the selection highlight, e.g. "rankings" */
  highlight: string;
  /** Optional line under the heading */
  sub?: ReactNode;
  align?: 'left' | 'center';
  /** 'light' for white/grey sections, 'dark' for the navy gradient headers */
  tone?: 'light' | 'dark';
  as?: 'h1' | 'h2';
  /** Text size classes for both lines; page heroes pass a larger scale */
  size?: string;
  className?: string;
  style?: CSSProperties;
}

const TONES = {
  light: {
    heading: 'text-[#0B2545]',
    lead: 'font-light',
    box: 'bg-[#0F3460]/[0.09]',
    handle: 'bg-[#059669]',
    sub: 'text-[#1F2937]/65',
  },
  dark: {
    heading: 'text-white',
    lead: 'font-light text-white/80',
    box: 'bg-white/[0.12]',
    handle: 'bg-[#34D399]',
    sub: 'text-white/70',
  },
};

/**
 * Section heading drawn like a text selection: a light lead line, then bold words in a
 * tinted box with a handle bar and dot at each end. Uses the site's navy + emerald theme.
 */
export default function SelectionHeading({
  lead,
  highlight,
  sub,
  align = 'left',
  tone = 'light',
  as: Tag = 'h2',
  size = 'text-3xl sm:text-4xl md:text-5xl',
  className = '',
  style,
}: SelectionHeadingProps) {
  const t = TONES[tone];
  const centered = align === 'center';

  return (
    <div style={style} className={`${centered ? 'text-center' : ''} ${className}`}>
      <Tag className={`${t.heading} leading-[0.95] tracking-[-0.03em]`}>
        {/* The space keeps "lead highlight" readable as text (crawlers, screen readers); the block span hides it visually. */}
        {lead && <><span className={`block ${size} ${t.lead}`}>{lead}</span>{' '}</>}
        <span className={`relative inline-block ${lead ? 'mt-2' : ''} px-2 sm:px-2.5 py-0.5 ${t.box} ${size} font-bold`}>
          {highlight}
          <span aria-hidden="true" className={`absolute left-0 top-0 bottom-0 w-[3px] ${t.handle}`}>
            <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full ${t.handle}`} />
          </span>
          <span aria-hidden="true" className={`absolute right-0 top-0 bottom-0 w-[3px] ${t.handle}`}>
            <span className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full ${t.handle}`} />
          </span>
        </span>
      </Tag>
      {sub && (
        <p className={`mt-5 sm:mt-6 text-sm sm:text-base ${t.sub} max-w-xl ${centered ? 'mx-auto' : ''}`}>{sub}</p>
      )}
    </div>
  );
}

/** Splits a plain title so its last word becomes the highlight: "Today's Top Rankings" -> ["Today's Top", "Rankings"]. */
export function splitTitle(title: string): { lead?: string; highlight: string } {
  const i = title.trim().lastIndexOf(' ');
  return i === -1 ? { highlight: title.trim() } : { lead: title.slice(0, i).trim(), highlight: title.slice(i + 1).trim() };
}
