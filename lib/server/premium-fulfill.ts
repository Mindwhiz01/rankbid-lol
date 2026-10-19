// Server-only: turn a paid Stripe Checkout Session into an active sponsored listing.
// Used by the Stripe webhook and, as a fallback when the webhook is late or missing,
// by the status endpoint the payment success page polls.
import { after } from 'next/server';
import type Stripe from 'stripe';
import { activatePremiumBid, getActiveHolders, getPremiumListing, updatePremiumListing, type PremiumHolder } from '@/lib/server/premium';
import { usdToCents } from '@/lib/server/stripe';
import { sbHeaders, sbUrl } from '@/lib/server/votes';
import { sendPremiumOutbidAlert, sendPremiumReceipt, sendPremiumRefundNotice } from '@/lib/email';
import { HOME_SPONSORED } from '@/lib/premiumSpots';

export type FulfillResult =
  | { ok: true; premiumListingId: string; result?: unknown; message?: string }
  | { ok: false; status: number; error: string };

/** Activates the bid behind a paid session. Safe to call more than once for the same session. */
export async function fulfillPaidSession(session: Stripe.Checkout.Session): Promise<FulfillResult> {
  const premiumListingId = session.metadata?.premiumListingId || session.client_reference_id;
  if (!premiumListingId) {
    console.error('Stripe session has no premiumListingId:', session.id);
    return { ok: true, premiumListingId: '', message: 'No premium listing on session' };
  }

  const premium = await getPremiumListing(premiumListingId);
  if (!premium) {
    console.error(`Premium listing not found for ID: ${premiumListingId}`);
    return { ok: false, status: 404, error: 'Premium listing not found' };
  }
  const txnRef = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || session.id;

  // Underpaying (wrong currency or amount) leaves the order pending for an admin to look at.
  const expectedCents = usdToCents(Number(premium.bid_usd ?? premium.payment_amount ?? 0));
  if (session.currency !== 'usd' || (session.amount_total ?? 0) < expectedCents) {
    console.error('Stripe amount lower than the bid:', { premiumListingId, amount: session.amount_total, currency: session.currency, expectedCents });
    await updatePremiumListing(premiumListingId, { payment_txn_ref: txnRef });
    return { ok: true, premiumListingId, message: 'Amount mismatch, held for review' };
  }

  // 'failed' + paid: the buyer paid just as a newer checkout for the same listing expired this one.
  // The money arrived, so the bid goes back to pending and is activated like any other.
  const wasPending = premium.payment_status === 'pending' || premium.payment_status === 'failed';
  if (wasPending) {
    await updatePremiumListing(premiumListingId, {
      payment_status: 'pending',
      payment_txn_ref: txnRef,
      payment_verified_at: new Date().toISOString(),
    });
  }

  // Activates the bid for life; it takes its rank among the others by price.
  const before = wasPending ? await getActiveHolders() : [];
  const result = await activatePremiumBid(premiumListingId);
  console.log('✅ Stripe premium payment processed:', premiumListingId, result);

  // Emails once per bid (the webhook and the success page can both get here), after the response is sent.
  if (wasPending && (await claimOnce(`fulfilled:${premiumListingId}`))) {
    const email = premium.founder_email || session.customer_details?.email || null;
    after(() => notifyLadderChange(premium, email, result, before).catch(err => console.error('Premium emails failed:', err)));
  }
  return { ok: true, premiumListingId, result };
}

/**
 * Records a one-time key in stripe_events. False when it was already recorded. If the table
 * hasn't been created yet (supabase/migrations/stripe_events.sql), it always returns true.
 */
export async function claimOnce(id: string, type = 'internal'): Promise<boolean> {
  const res = await fetch(sbUrl('stripe_events'), {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=representation' }),
    body: JSON.stringify({ id, type }),
    cache: 'no-store',
  });
  if (!res.ok) {
    console.warn('Stripe replay guard unavailable:', res.status, await res.text());
    return true;
  }
  const rows: unknown[] = await res.json();
  return rows.length > 0;
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
