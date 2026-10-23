import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/server/admin';
import { sbHeaders, sbUrl } from '@/lib/server/votes';
import { activatePremiumBid, getActiveHolders, getPremiumListing, updatePremiumListing } from '@/lib/server/premium';
import { getStripe } from '@/lib/server/stripe';
import { logAdminActivity } from '@/lib/server/admin-activity';

async function stripePaid(ref: unknown): Promise<boolean> {
  const stripe = getStripe();
  if (!stripe || typeof ref !== 'string') return false;
  if (ref.startsWith('pi_')) return (await stripe.paymentIntents.retrieve(ref)).status === 'succeeded';
  if (ref.startsWith('cs_')) return (await stripe.checkout.sessions.retrieve(ref)).payment_status === 'paid';
  return false;
}

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    // An empty ?status= lists every row.
    const status = searchParams.get('status') ?? 'pending';

    const filter = status ? `&payment_status=eq.${encodeURIComponent(status)}` : '';
    const res = await fetch(
      sbUrl(`premium_listings?select=*,listing:listings(title,description,category,total_votes,day_votes)&order=created_at.desc${filter}`),
      { headers: sbHeaders(), cache: 'no-store' }
    );
    if (!res.ok) {
      throw new Error(`${res.status} ${await res.text()}`);
    }
    const rows: any[] = await res.json();
    // Active listings show their live rank by price; others keep the rank recorded at checkout/activation.
    const liveRank = new Map((await getActiveHolders()).map(h => [h.id, h.position]));
    const dashboard = `https://dashboard.stripe.com${process.env.STRIPE_SECRET_KEY?.startsWith('sk_test') ? '/test' : ''}`;

    return NextResponse.json({
      premiumListings: rows.map(({ listing, ...row }) => ({
        ...row,
        position: liveRank.get(row.id) ?? row.position ?? null,
        // After the webhook the ref is the PaymentIntent (pi_…); before it, the Checkout Session (cs_…).
        stripe_url: row.payment_method === 'stripe' && typeof row.payment_txn_ref === 'string'
          ? row.payment_txn_ref.startsWith('pi_')
            ? `${dashboard}/payments/${row.payment_txn_ref}`
            : `${dashboard}/checkout/sessions/${row.payment_txn_ref}`
          : null,
        listing_title: listing?.title ?? null,
        listing_description: listing?.description ?? null,
        category: listing?.category ?? null,
        total_votes: listing?.total_votes ?? 0,
        day_votes: listing?.day_votes ?? 0,
      })),
    });
  } catch (error) {
    console.error('Error fetching premium listings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch premium listings' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { premiumListingId, status, approvedBy } = await req.json();

    if (!premiumListingId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    const premium = await getPremiumListing(premiumListingId);
    if (!premium) {
      return NextResponse.json(
        { error: 'Premium listing not found' },
        { status: 404 }
      );
    }
    if (premium.payment_status !== 'pending') {
      return NextResponse.json(
        { error: `Already ${premium.payment_status}` },
        { status: 409 }
      );
    }

    // A Stripe order is only approved once Stripe confirms the money arrived (covers a missed webhook).
    if (status === 'approved' && premium.payment_method === 'stripe' && !(await stripePaid(premium.payment_txn_ref))) {
      return NextResponse.json(
        { error: 'Stripe shows this order as unpaid' },
        { status: 409 }
      );
    }

    await updatePremiumListing(premiumListingId, {
      approved_at: new Date().toISOString(),
      approved_by: approvedBy || 'admin',
      ...(status === 'rejected' ? { payment_status: 'rejected' } : {}),
    });

    // Approval activates the bid for life; it takes its rank among the others by price.
    const result = status === 'approved' ? await activatePremiumBid(premiumListingId) : { status: 'rejected' };
    await logAdminActivity(req, status === 'approved' ? 'premium.approve' : 'premium.reject', premium.founder_name || premium.listing_id || premiumListingId, {
      premiumListingId,
      order: premium,
      result,
    });

    return NextResponse.json({
      success: true,
      result,
      premiumListing: await getPremiumListing(premiumListingId),
    });
  } catch (error) {
    console.error('Error updating premium listing:', error);
    return NextResponse.json(
      { error: 'Failed to update premium listing' },
      { status: 500 }
    );
  }
}
