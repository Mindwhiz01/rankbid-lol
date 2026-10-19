import { NextRequest, NextResponse } from 'next/server';
import { sbHeaders, sbUrl, supabaseConfigured } from '@/lib/server/votes';
import { getActiveHolders, updatePremiumListing, usdToPkr } from '@/lib/server/premium';
import { MIN_BID_USD, rankForBid } from '@/lib/premiumSpots';
import { getStripe, usdToCents } from '@/lib/server/stripe';
import { ipHash, rateLimit } from '@/lib/server/rate-limit';
import { httpUrlOrNull, staticUrlProblem } from '@/lib/server/url-safety';
import { getSessionUser } from '@/lib/server/session';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9 ()-]{6,19}$/;
const HANDLE_RE = /^@?[A-Za-z0-9_.-]{1,50}$/;
const URL_FIELDS = ['founderWebsite', 'founderLinkedin', 'founderFacebook', 'founderYoutube'] as const;
const HANDLE_FIELDS = ['founderTwitter', 'founderInstagram', 'founderTiktok', 'founderGithub'] as const;
/** Profile URL prefixes each handle field accepts and strips ("x.com/handle" → "handle"). */
const HANDLE_HOSTS: Record<(typeof HANDLE_FIELDS)[number], RegExp> = {
  founderTwitter: /^(www\.|mobile\.)?(x|twitter)\.com\//i,
  founderInstagram: /^(www\.)?instagram\.com\//i,
  founderTiktok: /^(www\.)?tiktok\.com\//i,
  founderGithub: /^(www\.)?github\.com\//i,
};

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Validated founder fields, or an error message. Links shown on the homepage must be safe http(s) URLs. */
function validateFounder(item: CartItem): { error: string } | { links: Record<string, string | null> } {
  const name = str(item.founderName);
  if (name.length < 2 || name.length > 80) return { error: 'Please enter your name (2–80 characters)' };
  const email = str(item.founderEmail);
  if (!EMAIL_RE.test(email) || email.length > 254) return { error: 'Please enter a valid email address' };
  if (!PHONE_RE.test(str(item.founderPhone))) return { error: 'Please enter a valid phone number' };

  const links: Record<string, string | null> = {};
  for (const field of URL_FIELDS) {
    const raw = str(item[field]);
    if (!raw) { links[field] = null; continue; }
    const url = httpUrlOrNull(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`, 300);
    if (!url || staticUrlProblem(url)) return { error: `That ${field.replace('founder', '')} link isn't allowed` };
    links[field] = url;
  }
  for (const field of HANDLE_FIELDS) {
    // Accept a pasted profile URL ("x.com/handle") and keep just the handle.
    const raw = str(item[field]).replace(/^https?:\/\//i, '').replace(/[?#].*$/, '').replace(/\/+$/, '')
      .replace(HANDLE_HOSTS[field], '').replace(/^@/, '');
    if (!raw) { links[field] = null; continue; }
    // A bare domain or another site's link ("linkedin.com/feed") is not a username.
    if (!HANDLE_RE.test(raw) || /\.(com|net|org|io|co)$/i.test(raw)) return { error: `Enter just the ${field.replace('founder', '')} username, e.g. @handle` };
    links[field] = raw;
  }
  return { links };
}

interface CartItem {
  listingId: string;
  /** What the buyer pays (whole USD). The rank follows from it. */
  bidUsd: number;
  founderName: string;
  founderEmail: string;
  founderPhone: string;
  founderWebsite?: string;
  founderTwitter?: string;
  founderLinkedin?: string;
  founderInstagram?: string;
  founderFacebook?: string;
  founderTiktok?: string;
  founderYoutube?: string;
  founderGithub?: string;
}

interface CheckoutRequest {
  items: CartItem[];
  paymentMethod: 'stripe';
}

export async function POST(req: NextRequest) {
  try {
    if (!supabaseConfigured()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Only the account that submitted a listing can make it premium.
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Please sign in to make your listing premium' }, { status: 401 });
    }

    if (!(await rateLimit(`checkout-ip:${ipHash(req)}`, 10, 60 * 60))) {
      return NextResponse.json({ error: 'Too many checkout attempts. Please try again later.' }, { status: 429 });
    }

    // Stripe is the only payment method.
    const { items, paymentMethod = 'stripe' } = await req.json() as CheckoutRequest;
    if (paymentMethod !== 'stripe') {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }

    // One spot per checkout: the gateway charges a single amount for a single bid.
    if (!Array.isArray(items) || items.length !== 1) {
      return NextResponse.json({ error: 'Sponsor one product per checkout' }, { status: 400 });
    }

    const item = items[0];
    if (typeof item?.listingId !== 'string' || !item.listingId || !item.founderName || !item.founderEmail || !item.founderPhone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const bidUsd = Number(item.bidUsd);
    if (!Number.isInteger(bidUsd) || bidUsd < MIN_BID_USD || bidUsd > 100_000) {
      return NextResponse.json({ error: `Enter a whole-dollar amount of at least $${MIN_BID_USD}` }, { status: 400 });
    }
    const founder = validateFounder(item);
    if ('error' in founder) {
      return NextResponse.json({ error: founder.error }, { status: 400 });
    }

    const stripe = getStripe();
    if (!stripe) {
      console.error('STRIPE_SECRET_KEY not configured');
      return NextResponse.json({ error: 'Card payments are not available right now' }, { status: 500 });
    }

    const listingRes = await fetch(sbUrl(`listings?id=eq.${encodeURIComponent(item.listingId)}&select=id,user_id`), {
      headers: sbHeaders(),
      cache: 'no-store',
    });
    const [listing] = listingRes.ok ? await listingRes.json() : [];
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }
    if (String(listing.user_id ?? '') !== user.id) {
      return NextResponse.json({ error: 'Only the person who submitted this listing can make it premium' }, { status: 403 });
    }

    // Expected rank right now (recorded for reference; the live rank is worked out from the bids).
    const others = (await getActiveHolders()).filter(h => h.listingId !== item.listingId);
    const position = rankForBid(bidUsd, others.map(h => h.bidUsd));
    const amountPkr = usdToPkr(bidUsd);

    const insertRes = await fetch(sbUrl('premium_listings'), {
      method: 'POST',
      headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
      body: JSON.stringify({
        listing_id: item.listingId,
        position,
        founder_name: str(item.founderName),
        founder_email: str(item.founderEmail).toLowerCase(),
        founder_phone: str(item.founderPhone),
        founder_website: founder.links.founderWebsite,
        founder_twitter: founder.links.founderTwitter,
        founder_linkedin: founder.links.founderLinkedin,
        founder_instagram: founder.links.founderInstagram,
        founder_facebook: founder.links.founderFacebook,
        founder_tiktok: founder.links.founderTiktok,
        founder_youtube: founder.links.founderYoutube,
        founder_github: founder.links.founderGithub,
        payment_method: paymentMethod,
        payment_status: 'pending',
        bid_usd: bidUsd,
        amount_pkr: amountPkr,
        payment_amount: bidUsd,
      }),
    });

    if (!insertRes.ok) {
      console.error('Failed to create premium listing:', insertRes.status, await insertRes.text());
      return NextResponse.json({ error: 'Failed to create premium listing' }, { status: 500 });
    }
    const [premiumListing] = await insertRes.json();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const success = new URL('/payment-success', appUrl);
    // The page reads the real status from the server; it never trusts amounts in the URL.
    success.searchParams.set('listing_id', premiumListing.id);
    // Stripe swaps in the real id; keep the braces unencoded.
    const successUrl = `${success.toString()}&txn_ref={CHECKOUT_SESSION_ID}`;

    const metadata = { product: 'rankbid', premiumListingId: premiumListing.id, position: String(position) };
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Charge and show the price in USD, as on the site. Adaptive Pricing would show the buyer's local currency (e.g. PKR).
      adaptive_pricing: { enabled: false },
      // Stripe picks the eligible methods, minus buy-now-pay-later: the listing goes live on payment.
      excluded_payment_method_types: ['klarna', 'afterpay_clearpay', 'affirm', 'zip', 'sunbit', 'scalapay', 'alma', 'billie'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: usdToCents(bidUsd),
          product_data: {
            name: 'RankBid Sponsored listing',
            description: `Sponsored for 30 days, ranked by price (currently #${position})`,
          },
        },
      }],
      customer_email: str(item.founderEmail).toLowerCase(),
      client_reference_id: premiumListing.id,
      metadata,
      payment_intent_data: {
        metadata,
        // Shows as "RANKBID* PREMIUM" on the card statement; the prefix is set in the Stripe Dashboard.
        statement_descriptor_suffix: 'PREMIUM',
      },
      custom_text: {
        submit: { message: 'Sponsored listings are ranked by price: a higher bid later can move you down. Your listing stays live for 30 days and is non-refundable once active.' },
      },
      success_url: successUrl,
      cancel_url: `${appUrl}/?premium=cancelled`,
      // Short-lived so an abandoned checkout doesn't promise a stale rank.
      // Stripe's minimum is 30 minutes; a little extra absorbs clock skew.
      expires_at: Math.floor(Date.now() / 1000) + 35 * 60,
    });

    await updatePremiumListing(premiumListing.id, { payment_txn_ref: session.id });

    return NextResponse.json({
      success: true,
      paymentRequired: true,
      paymentMethod: 'stripe',
      redirectUrl: session.url,
      premiumListings: [premiumListing],
      totalPrice: bidUsd,
      itemCount: 1,
    });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Checkout failed. Please try again.' }, { status: 500 });
  }
}
