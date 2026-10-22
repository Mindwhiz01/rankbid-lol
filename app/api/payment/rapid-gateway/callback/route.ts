import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { activatePremiumBid, getPremiumListing, updatePremiumListing } from '@/lib/server/premium';

/**
 * Webhook handler for Rapid Gateway payment notifications
 * Rapid Gateway sends signed JSON webhooks to this endpoint
 *
 * Signature verification:
 * expected = HMAC_SHA256(signingSecret, timestamp + "." + rawBody)
 */
export async function POST(req: NextRequest) {
  try {
    // Get headers for signature verification
    const signature = req.headers.get('x-rapidgateway-signature');
    const timestamp = req.headers.get('x-rapidgateway-timestamp');
    const eventType = req.headers.get('x-rapidgateway-event');

    // Validate required headers
    if (!signature || !timestamp || !eventType) {
      console.error('Missing webhook headers:', { signature: !!signature, timestamp: !!timestamp, eventType: !!eventType });
      return NextResponse.json(
        { error: 'Invalid webhook headers' },
        { status: 400 }
      );
    }

    // Get the raw body for signature verification
    const rawBody = await req.text();
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 });
    }

    // Validate required payload fields
    const { eventType: payloadEventType, merchantTransactionId, status, amount, gatewayTxnRef } = body;

    if (!payloadEventType || !merchantTransactionId || !status) {
      console.error('Missing payload fields:', { payloadEventType, merchantTransactionId, status });
      return NextResponse.json(
        { error: 'Invalid webhook payload' },
        { status: 400 }
      );
    }

    // Get signing salt
    const signingSecret = process.env.RAPID_GATEWAY_SIGNING_SALT || '';
    if (!signingSecret) {
      console.error('RAPID_GATEWAY_SIGNING_SALT not configured');
      return NextResponse.json(
        { error: 'Webhook verification not configured' },
        { status: 500 }
      );
    }

    // Verify signature: HMAC_SHA256(secret, timestamp + "." + rawBody)
    const payload = `${timestamp}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', signingSecret)
      .update(payload)
      .digest('hex')
      .toUpperCase();

    const received = Buffer.from(signature.toUpperCase());
    const expected = Buffer.from(expectedSignature);
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
      // Never log the expected signature: it would be a valid signature for this payload.
      console.error('Webhook signature verification failed');
      return NextResponse.json(
        { error: 'Signature verification failed' },
        { status: 403 }
      );
    }

    // Verify timestamp is recent (within 5 minutes)
    const webhookTime = parseInt(timestamp);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(currentTime - webhookTime);

    if (!Number.isFinite(timeDiff) || timeDiff > 300) {
      console.error('Webhook timestamp too old:', timeDiff, 'seconds');
      return NextResponse.json(
        { error: 'Webhook timestamp expired' },
        { status: 403 }
      );
    }

    console.log('✅ Webhook verified - Event:', eventType, 'Status:', status);

    // Only process completed/failed payments
    if (eventType !== 'transaction.completed' && eventType !== 'transaction.failed') {
      console.log('ℹ️ Ignoring event type:', eventType);
      return NextResponse.json({ success: true, message: 'Event ignored' });
    }

    // merchantTransactionId is the BASKET_ID: {premiumListingId}-{timestamp}. The id itself may contain dashes.
    const premiumListingId = premiumIdFromBasket(merchantTransactionId);
    const premium = await getPremiumListing(premiumListingId);
    if (!premium) {
      console.error(`Premium listing not found for ID: ${premiumListingId}`);
      return NextResponse.json({ error: 'Premium listing not found' }, { status: 404 });
    }

    try {
      if (eventType === 'transaction.completed' && status === 'SUCCESS') {
        // Underpaying (e.g. a tampered amount) or no amount at all leaves the order pending for an admin to look at.
        if (amount == null || !(Number(amount) >= Number(premium.amount_pkr || 0))) {
          console.error('Payment amount lower than the bid:', { premiumListingId, amount, expected: premium.amount_pkr });
          await updatePremiumListing(premiumListingId, { payment_txn_ref: gatewayTxnRef || merchantTransactionId });
          return NextResponse.json({ success: true, message: 'Amount mismatch, held for review' });
        }

        if (premium.payment_status === 'pending') {
          await updatePremiumListing(premiumListingId, {
            payment_txn_ref: gatewayTxnRef || merchantTransactionId,
            payment_verified_at: new Date().toISOString(),
          });
        }

        // Activates the bid for life; it takes its rank among the others by price.
        const result = await activatePremiumBid(premiumListingId);
        console.log('✅ Premium payment processed:', premiumListingId, result);

        return NextResponse.json({ success: true, message: 'Payment confirmed', premiumListingId, result });
      }

      if (premium.payment_status === 'pending') {
        await updatePremiumListing(premiumListingId, {
          payment_status: 'failed',
          payment_txn_ref: gatewayTxnRef || merchantTransactionId,
        });
      }
      console.log('❌ Payment failed for listing:', premiumListingId);
      return NextResponse.json({ success: true, message: 'Payment failure recorded', premiumListingId });
    } catch (dbError: any) {
      console.error('Database error processing premium payment:', dbError);
      return NextResponse.json({ error: 'Failed to update payment status' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Rapid Gateway webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

function premiumIdFromBasket(basketId: string): string {
  const cut = basketId.lastIndexOf('-');
  return cut > 0 ? basketId.slice(0, cut) : basketId;
}

/**
 * GET handler for browser-based redirect flow
 * NOTE: Rapid Gateway docs state SUCCESS_URL/FAILURE_URL don't receive parameters
 * The basket_id should be passed through the URL, and webhook is the source of truth
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const basketId = searchParams.get('basket_id');

  if (!basketId) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/error?message=Invalid payment response`);
  }

  // Extract premium listing ID from basket_id
  const premiumListingId = premiumIdFromBasket(basketId);

  // Redirect to success page with basket_id for client-side tracking
  // The webhook will be the authoritative source
  const successUrl = new URL('/payment-success', process.env.NEXT_PUBLIC_APP_URL);
  successUrl.searchParams.set('basket_id', basketId);
  successUrl.searchParams.set('listing_id', premiumListingId);

  return NextResponse.redirect(successUrl.toString());
}
