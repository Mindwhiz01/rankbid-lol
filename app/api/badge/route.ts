import { NextRequest, NextResponse } from 'next/server';
import { BADGE_THEMES, renderBadge, type BadgeTheme } from '@/lib/server/badges';

/**
 * Hosted "#N Sponsored on RankBid" badge, for the embed snippets in the buyer's badge zip.
 * /api/badge?rank=3&theme=dark. The image only depends on the query, so it is cached for good.
 */
export async function GET(req: NextRequest) {
  const rank = Number(req.nextUrl.searchParams.get('rank'));
  const theme = (req.nextUrl.searchParams.get('theme') || 'light') as BadgeTheme;
  if (!Number.isInteger(rank) || rank < 1 || rank > 9999 || !BADGE_THEMES.includes(theme)) {
    return NextResponse.json({ error: 'rank must be 1-9999 and theme light or dark' }, { status: 400 });
  }
  const png = await renderBadge(rank, theme);
  return new NextResponse(png as BodyInit, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
