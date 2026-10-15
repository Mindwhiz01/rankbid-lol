import { NextRequest, NextResponse } from 'next/server';
import { sbHeaders, sbUrl } from '@/lib/server/votes';
import { ipHash, rateLimit } from '@/lib/server/rate-limit';
import { safeExternalUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Counts one click on a listing and returns its product URL (null if the listing doesn't exist)
 * and whether this click was counted.
 * A visitor counts once per listing every 30 minutes, whether they opened the product page,
 * the product's site, or both.
 */
async function recordClick(req: NextRequest, listingId: string): Promise<{ target: string | null; counted: boolean }> {
  const count = await rateLimit(`click:${listingId}:${ipHash(req)}`, 1, 30 * 60);
  const res = await fetch(sbUrl('rpc/record_listing_click'), {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ p_id: listingId, p_count: count }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`record_listing_click failed: ${res.status} ${await res.text()}`);
  return { target: safeExternalUrl(await res.json()), counted: count };
}

const validId = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 64;

/** Outbound link to a listing: counts the click, then redirects to the product's site. */
export async function GET(req: NextRequest) {
  const listingId = req.nextUrl.searchParams.get('id');
  if (!validId(listingId)) {
    return NextResponse.json({ error: 'Listing ID required' }, { status: 400 });
  }

  try {
    const { target } = await recordClick(req, listingId);
    if (!target) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }
    return NextResponse.redirect(target, 302);
  } catch (error) {
    // Counting failed: still send the visitor where they wanted to go.
    console.error('Click tracking error:', error);
    const res = await fetch(sbUrl(`listings?id=eq.${encodeURIComponent(listingId)}&select=location`), {
      headers: sbHeaders(),
      cache: 'no-store',
    }).catch(() => null);
    const [row] = res?.ok ? await res.json() : [];
    const target = safeExternalUrl(row?.location);
    return NextResponse.redirect(target ?? new URL(`/product/${encodeURIComponent(listingId)}`, req.url), 302);
  }
}

/** Counts a click without redirecting (the product page calls this when it opens). */
export async function POST(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}));
  if (!validId(id)) {
    return NextResponse.json({ error: 'Listing ID required' }, { status: 400 });
  }

  try {
    const { target, counted } = await recordClick(req, id);
    if (!target) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    return NextResponse.json({ counted });
  } catch (error) {
    console.error('Click tracking error:', error);
    return NextResponse.json({ error: 'Click tracking failed' }, { status: 500 });
  }
}
