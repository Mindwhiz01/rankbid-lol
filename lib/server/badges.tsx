// Server-only: "#N Sponsored on RankBid" badges for paid spots and "#N Ranked on RankBid" cards for voted listings,
// emailed as a zip and served at /api/badge.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { zipSync } from 'fflate';
import { LOGO_WHITE_RATIO } from '@/lib/server/brand-logo';
import { SITE_URL } from '@/lib/site';

export type BadgeTheme = 'light' | 'dark';
export const BADGE_THEMES: BadgeTheme[] = ['light', 'dark'];

/** sponsored: a paid spot (ranked by price); ranked: a free listing (ranked by votes). */
export type BadgeKind = 'sponsored' | 'ranked';
export const BADGE_KINDS: BadgeKind[] = ['sponsored', 'ranked'];
const BADGE_LABEL: Record<BadgeKind, string> = { sponsored: 'SPONSORED ON', ranked: 'RANKED ON' };

/** Rendered at 2x for sharp screens; embed it at half size (360x100). */
export const BADGE_SIZE = { width: 720, height: 200 };

const logos: Partial<Record<BadgeTheme, Promise<string>>> = {};
function logoFor(theme: BadgeTheme): Promise<string> {
  // The navy logo sits on the white badge, the white logo on the navy one. Both share one aspect ratio.
  const file = theme === 'light' ? 'logo-horizontal.png' : 'logo-horizontal-white.png';
  return (logos[theme] ??= readFile(join(process.cwd(), 'public/brand', file)).then(b => `data:image/png;base64,${b.toString('base64')}`));
}

export async function renderBadge(position: number, theme: BadgeTheme, kind: BadgeKind = 'sponsored'): Promise<Uint8Array> {
  const logo = await logoFor(theme);
  const dark = theme === 'dark';
  const image = new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 32, padding: '0 40px',
          borderRadius: 40, border: `4px solid ${dark ? '#1a5490' : '#FCD34D'}`,
          background: dark ? 'linear-gradient(135deg, #0B2545 0%, #0F3460 60%, #1a5490 100%)' : '#FFFBEB',
        }}
      >
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: 132, height: 132, borderRadius: 32,
            background: 'linear-gradient(135deg, #FBBF24 0%, #D97706 100%)', color: 'white',
            fontSize: position >= 100 ? 44 : 60, fontWeight: 900,
          }}
        >
          #{position}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 5, color: dark ? '#FCD34D' : '#B45309' }}>{BADGE_LABEL[kind]}</div>
          <img src={logo} alt="RankBid" width={Math.round(64 * LOGO_WHITE_RATIO)} height={64} />
        </div>
      </div>
    ),
    BADGE_SIZE,
  );
  return new Uint8Array(await image.arrayBuffer());
}

/** The embed snippet for one theme: the hosted badge linking to the product page. */
function embedHtml(listingId: string, position: number, theme: BadgeTheme, kind: BadgeKind): string {
  const href = `${SITE_URL}/product/${encodeURIComponent(listingId)}`;
  const src = `${SITE_URL}/api/badge?rank=${position}&theme=${theme}${kind === 'ranked' ? '&kind=ranked' : ''}`;
  const alt = `#${position} ${kind === 'ranked' ? 'Ranked' : 'Sponsored'} on RankBid`;
  return `<a href="${href}" target="_blank" rel="noopener"><img src="${src}" alt="${alt}" width="360" height="100" /></a>`;
}

/** Zip with both badge themes plus a README holding the embed snippets. */
export async function badgeZip(listingId: string, position: number, kind: BadgeKind = 'sponsored'): Promise<Uint8Array> {
  const pngs = await Promise.all(BADGE_THEMES.map(theme => renderBadge(position, theme, kind)));
  const readme = [
    `Your RankBid badges for #${position}`,
    '',
    ...(kind === 'ranked' ? ['This is your rank when you submitted. Votes move it, so your product page always shows the live one.', ''] : []),
    'Add a badge to your site so visitors can see your rank. Use the PNG files in this folder,',
    'or paste one of these snippets into your HTML:',
    '',
    ...BADGE_THEMES.flatMap(theme => [`${theme[0].toUpperCase()}${theme.slice(1)} background:`, embedHtml(listingId, position, theme, kind), '']),
    'The PNGs are 720x200; show them at 360x100 so they stay sharp.',
  ].join('\n');

  const files: Record<string, Uint8Array> = { 'README.txt': new TextEncoder().encode(readme) };
  BADGE_THEMES.forEach((theme, i) => { files[`rankbid-${kind}-${position}-${theme}.png`] = pngs[i]; });
  // PNGs are already compressed, so they're stored as is.
  return zipSync(files, { level: 0 });
}
