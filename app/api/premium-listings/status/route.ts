import { NextRequest, NextResponse } from 'next/server';
import { getActiveHolders, getPremiumListing } from '@/lib/server/premium';
import { getSessionUser } from '@/lib/server/session';
import { sbHeaders, sbUrl, supabaseConfigured } from '@/lib/server/votes';

/**
 * Status of one premium bid, for the payment success page to poll while the Stripe webhook confirms it.
 * Read-only: the listing is only ever activated by the webhook. Only the listing's owner can read it.
 */
export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id') || '';
  const premium = id ? await getPremiumListing(id) : null;
  if (!premium) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }

  const listingRes = await fetch(sbUrl(`listings?id=eq.${encodeURIComponent(premium.listing_id)}&select=user_id,title`), {
    headers: sbHeaders(),
    cache: 'no-store',
  });
  const [listing] = listingRes.ok ? await listingRes.json() : [];
  if (!listing || String(listing.user_id ?? '') !== user.id) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }

  // Live rank while active (others may have bid since); otherwise the rank it was expected to get.
  const live = premium.payment_status === 'active' ? (await getActiveHolders()).find(h => h.id === premium.id) : undefined;

  return NextResponse.json(
    {
      status: premium.payment_status as string,
      position: (live?.position ?? premium.position ?? null) as number | null,
      bidUsd: Number(premium.bid_usd ?? premium.payment_amount ?? 0),
      expiresAt: premium.expires_at ?? null,
      productTitle: listing.title ?? null,
      reference: typeof premium.payment_txn_ref === 'string' && premium.payment_txn_ref.startsWith('pi_') ? premium.payment_txn_ref : null,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
