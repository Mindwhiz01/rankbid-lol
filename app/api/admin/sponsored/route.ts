import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/server/admin';
import { sbHeaders, sbUrl } from '@/lib/server/votes';
import { getActiveHolders } from '@/lib/server/premium';

export const dynamic = 'force-dynamic';

/** Paid orders whose money we keep: live, or ended after being live. */
const EARNED = new Set(['active', 'outbid', 'replaced']);
/** Paid, but the money goes (or went) back to the buyer. */
const REFUND = new Set(['needs_refund', 'rejected']);

// Money this order took: payment_amount (a raise charges only the added part; bid_usd is the spot's total).
const amountOf = (r: any) => Number(r.payment_amount ?? r.bid_usd ?? 0) || 0;
const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Every sponsored order with who paid (the RankBid account that owns the product plus the
 * founder details from checkout) and revenue totals, for the admin dashboard's Sponsored tab.
 */
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch(
      sbUrl('premium_listings?select=*,listing:listings(title,location,user_id)&order=created_at.desc&limit=2000'),
      { headers: sbHeaders(), cache: 'no-store' }
    );
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();

    // Account (name/email) behind each product.
    const userIds = [...new Set(rows.map(r => r.listing?.user_id).filter(Boolean).map(String))];
    const users = new Map<string, { email: string; name: string | null }>();
    if (userIds.length) {
      const list = encodeURIComponent(userIds.map(id => `"${id.replace(/"/g, '')}"`).join(','));
      const ures = await fetch(sbUrl(`users?id=in.(${list})&select=id,email,name`), { headers: sbHeaders(), cache: 'no-store' });
      if (ures.ok) for (const u of await ures.json()) users.set(String(u.id), { email: u.email, name: u.name ?? null });
    }

    const liveRank = new Map((await getActiveHolders()).map(h => [h.id, h.position]));
    const dashboard = `https://dashboard.stripe.com${process.env.STRIPE_SECRET_KEY?.startsWith('sk_test') || process.env.STRIPE_SECRET_KEY?.startsWith('rk_test') ? '/test' : ''}`;

    const orders = rows.map(({ listing, ...r }) => {
      const paid = Boolean(r.payment_verified_at);
      const ref = typeof r.payment_txn_ref === 'string' ? r.payment_txn_ref : null;
      return {
        id: r.id as string,
        listingId: r.listing_id as string,
        productTitle: (listing?.title as string) ?? null,
        productUrl: (listing?.location as string) ?? null,
        account: listing?.user_id ? users.get(String(listing.user_id)) ?? null : null,
        founderName: r.founder_name ?? null,
        founderEmail: r.founder_email ?? null,
        founderPhone: r.founder_phone ?? null,
        amountUsd: amountOf(r),
        status: r.payment_status as string,
        paid,
        rank: liveRank.get(r.id) ?? null,
        createdAt: r.created_at as string,
        paidAt: (r.payment_verified_at as string) ?? null,
        expiresAt: (r.expires_at as string) ?? null,
        stripeUrl: r.payment_method === 'stripe' && ref
          ? ref.startsWith('pi_') ? `${dashboard}/payments/${ref}` : `${dashboard}/checkout/sessions/${ref}`
          : null,
      };
    });

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const earned = orders.filter(o => o.paid && EARNED.has(o.status));
    const sum = (list: typeof orders) => cents(list.reduce((n, o) => n + o.amountUsd, 0));
    const active = orders.filter(o => o.status === 'active' && o.rank != null);
    const refunds = orders.filter(o => o.paid && REFUND.has(o.status));

    return NextResponse.json({
      summary: {
        totalEarnedUsd: sum(earned),
        paidOrders: earned.length,
        payingCustomers: new Set(earned.map(o => o.account?.email || o.founderEmail || o.listingId)).size,
        thisMonthUsd: sum(earned.filter(o => o.paidAt && new Date(o.paidAt) >= monthStart)),
        activeCount: active.length,
        activeUsd: sum(active),
        refundCount: refunds.length,
        refundUsd: sum(refunds),
        pendingCount: orders.filter(o => o.status === 'pending').length,
      },
      orders,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error loading sponsored orders:', error);
    return NextResponse.json({ error: 'Failed to load sponsored orders' }, { status: 500 });
  }
}
