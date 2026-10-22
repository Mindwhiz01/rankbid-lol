import { NextRequest, NextResponse } from 'next/server';
import { BADGE_KINDS, BADGE_THEMES, renderBadge, type BadgeKind, type BadgeTheme } from '@/lib/server/badges';

/**
 * Hosted "#N Sponsored on RankBid" (or, with kind=ranked, "#N Ranked on RankBid") badge, for the embed
 * snippets in the badge zips. /api/badge?rank=3&theme=dark&kind=ranked. The image only depends on the query, so it is cached for good.
 */
export async function GET(req: NextRequest) {
  const rank = Number(req.nextUrl.searchParams.get('rank'));
  const theme = (req.nextUrl.searchParams.get('theme') || 'light') as BadgeTheme;
  const kind = (req.nextUrl.searchParams.get('kind') || 'sponsored') as BadgeKind;
  if (!Number.isInteger(rank) || rank < 1 || rank > 9999 || !BADGE_THEMES.includes(theme) || !BADGE_KINDS.includes(kind)) {
    return NextResponse.json({ error: 'rank must be 1-9999, theme light or dark, kind sponsored or ranked' }, { status: 400 });
  }
  const png = await renderBadge(rank, theme, kind);
  return new NextResponse(png as BodyInit, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
