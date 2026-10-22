import { NextRequest, NextResponse } from 'next/server';
import { getActiveHolders, getPremiumListing } from '@/lib/server/premium';
import { fulfillPaidSession } from '@/lib/server/premium-fulfill';
import { getSessionUser } from '@/lib/server/session';
import { getStripe } from '@/lib/server/stripe';
import { sbHeaders, sbUrl, supabaseConfigured } from '@/lib/server/votes';

/**
 * Status of one premium bid, for the payment success page to poll while the Stripe webhook confirms it.
 * The webhook normally activates the bid; if it hasn't yet, this checks the session with Stripe and
 * activates a paid one, so a missed webhook never leaves a paid listing pending. Only the listing's owner can read it.
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
  let premium = id ? await getPremiumListing(id) : null;
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

  // Webhook late or missing: ask Stripe about the Checkout Session and activate the bid if it's paid.
  // ('failed' too: a newer checkout may have closed this one just as it was paid.)
  if ((premium.payment_status === 'pending' || premium.payment_status === 'failed') &&
      typeof premium.payment_txn_ref === 'string' && premium.payment_txn_ref.startsWith('cs_')) {
    const stripe = getStripe();
    if (stripe) {
      try {
        const session = await stripe.checkout.sessions.retrieve(premium.payment_txn_ref);
        const sessionPremiumId = session.metadata?.premiumListingId || session.client_reference_id;
        if (session.payment_status === 'paid' && sessionPremiumId === premium.id) {
          await fulfillPaidSession(session);
          premium = (await getPremiumListing(id)) ?? premium;
        }
      } catch (err) {
        console.error('Status: Stripe session check failed', premium.id, err);
      }
    }
  }

  // Live rank while active (others may have bid since); otherwise the rank it was expected to get.
  const live = premium.payment_status === 'active' ? (await getActiveHolders()).find(h => h.id === premium.id) : undefined;

  return NextResponse.json(
    {
      status: premium.payment_status as string,
      position: (live?.position ?? premium.position ?? null) as number | null,
      bidUsd: Number(premium.bid_usd ?? premium.payment_amount ?? 0),
      // What this order charged: less than bidUsd when it raised a live bid.
      paidUsd: Number(premium.payment_amount ?? premium.bid_usd ?? 0),
      expiresAt: premium.expires_at ?? null,
      productTitle: listing.title ?? null,
      reference: typeof premium.payment_txn_ref === 'string' && premium.payment_txn_ref.startsWith('pi_') ? premium.payment_txn_ref : null,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
