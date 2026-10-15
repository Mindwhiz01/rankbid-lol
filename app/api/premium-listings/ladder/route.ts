import { NextResponse } from 'next/server';
import { getActiveHolders } from '@/lib/server/premium';
import { sbHeaders, sbUrl } from '@/lib/server/votes';

export const dynamic = 'force-dynamic';

/** Every live sponsored listing in rank order, so the premium modal can preview where a bid lands. */
export async function GET() {
  const holders = await getActiveHolders();

  // Product names, so the preview can say who a bid passes.
  const titles = new Map<string, string>();
  if (holders.length > 0) {
    const list = encodeURIComponent(holders.map(h => `"${h.listingId.replace(/"/g, '')}"`).join(','));
    const res = await fetch(sbUrl(`listings?id=in.(${list})&select=id,title`), { headers: sbHeaders(), cache: 'no-store' });
    if (res.ok) for (const row of (await res.json()) as { id: string; title: string }[]) titles.set(String(row.id), row.title);
  }

  return NextResponse.json({
    ranked: holders.map(h => ({
      position: h.position,
      listingId: h.listingId,
      title: titles.get(h.listingId) ?? null,
      bidUsd: h.bidUsd,
      expiresAt: h.expiresAt,
    })),
  });
}
