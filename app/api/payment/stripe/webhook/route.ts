import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getPremiumListing, updatePremiumListing } from '@/lib/server/premium';
import { claimOnce, fulfillPaidSession } from '@/lib/server/premium-fulfill';
import { getStripe } from '@/lib/server/stripe';
import { sbHeaders, sbUrl } from '@/lib/server/votes';

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
  if (!(await claimOnce(event.id, event.type))) {
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
  try {
    if (paid) {
      const out = await fulfillPaidSession(session);
      if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
      return NextResponse.json({ received: true, ...out });
    }

    const premiumListingId = session.metadata?.premiumListingId || session.client_reference_id;
    if (!premiumListingId) {
      console.error('Stripe session has no premiumListingId:', session.id);
      return NextResponse.json({ received: true, message: 'No premium listing on session' });
    }
    const premium = await getPremiumListing(premiumListingId);
    if (!premium) {
      console.error(`Premium listing not found for ID: ${premiumListingId}`);
      return NextResponse.json({ error: 'Premium listing not found' }, { status: 404 });
    }
    const txnRef = typeof session.payment_intent === 'string' ? session.payment_intent : session.id;
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

async function releaseEvent(id: string): Promise<void> {
  await fetch(sbUrl(`stripe_events?id=eq.${encodeURIComponent(id)}`), { method: 'DELETE', headers: sbHeaders() })
    .catch(err => console.error('Failed to release Stripe event', id, err));
}
