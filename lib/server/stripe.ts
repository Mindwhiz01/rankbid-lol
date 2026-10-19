// Server-only Stripe client. Stripe charges premium bids in USD (no PKR conversion).
import Stripe from 'stripe';
import { SITE_URL } from '@/lib/site';

let client: Stripe | null = null;

/**
 * Null when STRIPE_SECRET_KEY isn't set, so callers can return a clean "not configured" error.
 * Only restricted keys (rk_test_ / rk_live_) are accepted; the account secret key never runs in the app.
 */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!/^rk_(test|live)_/.test(key)) {
    console.error('STRIPE_SECRET_KEY must be a restricted key (rk_test_ or rk_live_)');
    return null;
  }
  client ??= new Stripe(key, {
    apiVersion: '2026-08-26.dahlia',
    appInfo: { name: 'RankBid', url: SITE_URL },
  });
  return client;
}

/** USD bid → Stripe's smallest currency unit (cents). */
export function usdToCents(usd: number): number {
  return Math.round(usd * 100);
}
