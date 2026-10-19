import { NextRequest, NextResponse, after } from 'next/server';
import type Stripe from 'stripe';
import { activatePremiumBid, getActiveHolders, getPremiumListing, updatePremiumListing, type PremiumHolder } from '@/lib/server/premium';
import { getStripe, usdToCents } from '@/lib/server/stripe';
import { sbHeaders, sbUrl } from '@/lib/server/votes';
import { sendPremiumOutbidAlert, sendPremiumReceipt, sendPremiumRefundNotice } from '@/lib/email';
import { HOME_SPONSORED } from '@/lib/premiumSpots';

/**
 * Stripe webhook for premium bids paid through Checkout.
 * Subscribe the endpoint to: checkout.session.completed, checkout.session.async_payment_succeeded,
 * checkout.session.async_payment_failed, checkout.session.expired, charge.refunded, charge.dispute.created.
 */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    console.error('Stripe webhook not configured');
    return NextResponse.json({ error: 'Webhook verification not configured' }, { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  // Signature verification needs the exact raw body.
  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    console.error('Stripe webhook signature verification failed');
    return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
  }

  // Replay guard: Stripe may deliver the same event more than once.
  if (!(await claimEvent(event))) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const res = await handleEvent(event);
  // A non-2xx makes Stripe retry; release the claim so the retry is processed.
  if (!res.ok) await releaseEvent(event.id);
  return res;
}

async function handleEvent(event: Stripe.Event): Promise<NextResponse> {
  if (event.type === 'charge.dispute.created') {
    // Ops decide what happens; the spot stays up until then.
    const dispute = event.data.object;
    console.warn('[OPS] Stripe dispute opened:', dispute.id, dispute.amount / 100, dispute.currency, 'payment', dispute.payment_intent);
    return NextResponse.json({ received: true });
  }

  if (event.type === 'charge.refunded') {
    // Admin refunds (rule violations) take the spot off the ladder so the board stays honest.
    const charge = event.data.object;
    const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
    if (!charge.refunded || !pi) return NextResponse.json({ received: true, message: 'Partial refund ignored' });
    try {
      const res = await fetch(
        sbUrl(`premium_listings?payment_txn_ref=eq.${encodeURIComponent(pi)}&payment_status=eq.active`),
        {
          method: 'PATCH',
          headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
          body: JSON.stringify({ payment_status: 'rejected', updated_at: new Date().toISOString() }),
        }
      );
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      console.log('↩️ Stripe refund removed premium spot for payment:', pi);
      return NextResponse.json({ received: true });
    } catch (error) {
      console.error('Database error processing Stripe refund:', error);
      return NextResponse.json({ error: 'Failed to update payment status' }, { status: 500 });
    }
  }

  const paid =
    (event.type === 'checkout.session.completed' && event.data.object.payment_status === 'paid') ||
    event.type === 'checkout.session.async_payment_succeeded';
  const failed = event.type === 'checkout.session.async_payment_failed' || event.type === 'checkout.session.expired';
  if (!paid && !failed) {
    return NextResponse.json({ received: true, message: 'Event ignored' });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const premiumListingId = session.metadata?.premiumListingId || session.client_reference_id;
  if (!premiumListingId) {
    console.error('Stripe session has no premiumListingId:', session.id);
    return NextResponse.json({ received: true, message: 'No premium listing on session' });
  }

  try {
    const premium = await getPremiumListing(premiumListingId);
    if (!premium) {
      console.error(`Premium listing not found for ID: ${premiumListingId}`);
      return NextResponse.json({ error: 'Premium listing not found' }, { status: 404 });
    }
    const txnRef = typeof session.payment_intent === 'string' ? session.payment_intent : session.id;

    if (paid) {
      // Underpaying (wrong currency or amount) leaves the order pending for an admin to look at.
      const expectedCents = usdToCents(Number(premium.bid_usd ?? premium.payment_amount ?? 0));
      if (session.currency !== 'usd' || (session.amount_total ?? 0) < expectedCents) {
        console.error('Stripe amount lower than the bid:', { premiumListingId, amount: session.amount_total, currency: session.currency, expectedCents });
        await updatePremiumListing(premiumListingId, { payment_txn_ref: txnRef });
        return NextResponse.json({ received: true, message: 'Amount mismatch, held for review' });
      }

      const wasPending = premium.payment_status === 'pending';
      if (wasPending) {
        await updatePremiumListing(premiumListingId, {
          payment_txn_ref: txnRef,
          payment_verified_at: new Date().toISOString(),
        });
      }

      // Activates the bid for life; it takes its rank among the others by price.
      const before = wasPending ? await getActiveHolders() : [];
      const result = await activatePremiumBid(premiumListingId);
      console.log('✅ Stripe premium payment processed:', premiumListingId, result);

      // Emails only on the delivery that changed the ranking, and after Stripe has its 200.
      if (wasPending) {
        const email = premium.founder_email || session.customer_details?.email || null;
        after(() => notifyLadderChange(premium, email, result, before).catch(err => console.error('Premium emails failed:', err)));
      }
      return NextResponse.json({ received: true, premiumListingId, result });
    }

    if (premium.payment_status === 'pending') {
      await updatePremiumListing(premiumListingId, { payment_status: 'failed', payment_txn_ref: txnRef });
    }
    console.log('❌ Stripe payment failed/expired for listing:', premiumListingId);
    return NextResponse.json({ received: true, premiumListingId });
  } catch (error) {
    // A 500 makes Stripe retry, and activate_premium_bid is safe to call more than once.
    console.error('Database error processing Stripe payment:', error);
    return NextResponse.json({ error: 'Failed to update payment status' }, { status: 500 });
  }
}

/**
 * Records the event id. False when it was already processed. If the stripe_events table
 * hasn't been created yet (supabase/migrations/stripe_events.sql), events are processed without the check.
 */
async function claimEvent(event: Stripe.Event): Promise<boolean> {
  const res = await fetch(sbUrl('stripe_events'), {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=representation' }),
    body: JSON.stringify({ id: event.id, type: event.type }),
    cache: 'no-store',
  });
  if (!res.ok) {
    console.warn('Stripe replay guard unavailable:', res.status, await res.text());
    return true;
  }
  const rows: unknown[] = await res.json();
  return rows.length > 0;
}

async function releaseEvent(id: string): Promise<void> {
  await fetch(sbUrl(`stripe_events?id=eq.${encodeURIComponent(id)}`), { method: 'DELETE', headers: sbHeaders() })
    .catch(err => console.error('Failed to release Stripe event', id, err));
}

/** Receipt or refund notice for the buyer, and alerts for holders the bid pushed out of the homepage top 10. */
async function notifyLadderChange(
  premium: { id: string; listing_id: string; position: number | null; bid_usd?: number | string | null; payment_amount?: number | string | null },
  buyerEmail: string | null,
  result: { status: string; position?: number; required?: number },
  before: PremiumHolder[]
): Promise<void> {
  const now = result.status === 'active' ? await getActiveHolders() : [];
  const afterById = new Map(now.map(h => [h.id, h]));
  // Holders that were on the homepage and no longer are; the buyer's own previous listing ("replaced") isn't an outbid.
  // Moving down within the top 10 (or below it) is not emailed.
  const pushed = before.filter(h =>
    h.listingId !== premium.listing_id && h.position <= HOME_SPONSORED && (afterById.get(h.id)?.position ?? 0) > HOME_SPONSORED
  );

  const titles = await listingTitles([premium.listing_id, ...pushed.map(h => h.listingId)]);
  const bidUsd = Number(premium.bid_usd ?? premium.payment_amount ?? 0);
  const position = Number(afterById.get(premium.id)?.position ?? result.position ?? premium.position ?? 0);
  const mine = { listingId: premium.listing_id, productTitle: titles.get(premium.listing_id) || 'Your product', position, bidUsd };

  const sends: Promise<unknown>[] = [];
  if (buyerEmail && result.status === 'active') {
    sends.push(sendPremiumReceipt({ ...mine, to: buyerEmail, expiresAt: afterById.get(premium.id)?.expiresAt }));
  } else if (buyerEmail && result.status === 'needs_refund') {
    sends.push(sendPremiumRefundNotice({ ...mine, to: buyerEmail, requiredUsd: result.required }));
  }
  for (const h of pushed) {
    if (!h.founderEmail) continue;
    sends.push(sendPremiumOutbidAlert({
      to: h.founderEmail,
      listingId: h.listingId,
      productTitle: titles.get(h.listingId) || 'Your product',
      position: h.position,
      bidUsd: h.bidUsd,
      newPosition: afterById.get(h.id)?.position ?? null,
    }));
  }
  await Promise.all(sends);
}

async function listingTitles(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const res = await fetch(sbUrl(`listings?id=in.(${unique.map(encodeURIComponent).join(',')})&select=id,title`), {
    headers: sbHeaders(),
    cache: 'no-store',
  });
  const rows: { id: string; title: string }[] = res.ok ? await res.json() : [];
  return new Map(rows.map(r => [String(r.id), r.title]));
}
