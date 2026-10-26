// Regression tests: every endpoint that acts for an account refuses requests that aren't signed in,
// and refuses them before reading or writing any data.
import { describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';
import { CROSS_SITE, makeRequest } from '../helpers';
import { fakeSupabase, MEMBER, tokenFor } from '../fake-supabase';

type Handler = (req: NextRequest) => Promise<Response>;
type Case = [name: string, load: () => Promise<Handler>, method: string, path: string, body?: unknown];

const member: Case[] = [
  ['votes POST', async () => (await import('@/app/api/votes/route')).POST, 'POST', '/api/votes', { listingId: 'l1' }],
  ['votes DELETE', async () => (await import('@/app/api/votes/route')).DELETE, 'DELETE', '/api/votes', { listingId: 'l1' }],
  ['auth/me GET', async () => (await import('@/app/api/auth/me/route')).GET, 'GET', '/api/auth/me'],
  ['user/profile GET', async () => (await import('@/app/api/user/profile/route')).GET, 'GET', '/api/user/profile'],
  ['user/profile PUT', async () => (await import('@/app/api/user/profile/route')).PUT, 'PUT', '/api/user/profile', { name: 'x' }],
  ['user/password GET', async () => (await import('@/app/api/user/password/route')).GET, 'GET', '/api/user/password'],
  ['user/password POST', async () => (await import('@/app/api/user/password/route')).POST, 'POST', '/api/user/password', { newPassword: 'longenough1' }],
  ['user/account DELETE', async () => (await import('@/app/api/user/account/route')).DELETE, 'DELETE', '/api/user/account', { confirm: 'DELETE' }],
  ['user/submissions GET', async () => (await import('@/app/api/user/submissions/route')).GET, 'GET', '/api/user/submissions'],
  ['user/submissions PATCH', async () => (await import('@/app/api/user/submissions/route')).PATCH, 'PATCH', '/api/user/submissions', { listingId: 'l1', title: 'x' }],
  ['user/submissions DELETE', async () => (await import('@/app/api/user/submissions/route')).DELETE, 'DELETE', '/api/user/submissions', { listingId: 'l1' }],
  ['user/votes GET', async () => (await import('@/app/api/user/votes/route')).GET, 'GET', '/api/user/votes'],
  ['listings/submit POST', async () => (await import('@/app/api/listings/submit/route')).POST, 'POST', '/api/listings/submit', { url: 'https://example.com', category: 'Other' }],
  ['premium checkout POST', async () => (await import('@/app/api/premium-listings/checkout/route')).POST, 'POST', '/api/premium-listings/checkout', { items: [] }],
  ['premium status GET', async () => (await import('@/app/api/premium-listings/status/route')).GET, 'GET', '/api/premium-listings/status?id=p1'],
];

describe('member endpoints refuse anonymous requests (401)', () => {
  it.each(member)('%s', async (_name, load, method, path, body) => {
    const db = fakeSupabase();
    const res = await (await load())(makeRequest(path, { method, body }));
    expect(res.status).toBe(401);
    expect(db.dataCalls()).toEqual([]);
  });

  it.each(member)('%s ignores an unknown session token', async (_name, load, method, path, body) => {
    const db = fakeSupabase();
    const res = await (await load())(makeRequest(path, { method, body, cookies: { auth_token: 'session_forged' } }));
    expect(res.status).toBe(401);
    expect(db.dataCalls()).toEqual([]);
  });
});

describe('a signed-in browser is not signed in for writes another site triggers (CSRF)', () => {
  it.each(member.filter(([, , method]) => method !== 'GET'))('%s', async (_name, load, method, path, body) => {
    const db = fakeSupabase();
    const res = await (await load())(makeRequest(path, { method, body, headers: CROSS_SITE, cookies: { auth_token: tokenFor(MEMBER) } }));
    expect(res.status).toBe(401);
    expect(db.writes()).toEqual([]);
  });

  it.each([
    ['auth/login', async () => (await import('@/app/api/auth/login/route')).POST, { email: 'a@b.co', password: 'x' }],
    ['auth/signup', async () => (await import('@/app/api/auth/signup/route')).POST, { email: 'a@b.co', password: 'longenough1' }],
    ['auth/google', async () => (await import('@/app/api/auth/google/route')).POST, { token: 'x' }],
    ['auth/verify-email', async () => (await import('@/app/api/auth/verify-email/route')).POST, { token: 'x' }],
    ['admin/session', async () => (await import('@/app/api/admin/session/route')).POST, {}],
  ] as const)('%s is refused cross-site (403)', async (_name, load, body) => {
    const db = fakeSupabase();
    const res = await (await load())(makeRequest('/api/x', { method: 'POST', body, headers: CROSS_SITE }));
    expect(res.status).toBe(403);
    expect(db.calls).toEqual([]);
  });
});

describe('machine endpoints need their secret', () => {
  it('cron refuses a missing or wrong secret (401)', async () => {
    const { GET } = await import('@/app/api/cron/reset-daily-votes/route');
    const db = fakeSupabase();
    expect((await GET(makeRequest('/api/cron/reset-daily-votes'))).status).toBe(401);
    expect((await GET(makeRequest('/api/cron/reset-daily-votes', { headers: { authorization: 'Bearer wrong' } }))).status).toBe(401);
    expect((await GET(makeRequest('/api/cron/reset-daily-votes', { headers: { authorization: 'Bearer test-cron-secret-but-longer' } }))).status).toBe(401);
    expect(db.calls).toEqual([]);
  });

  it('Stripe webhook refuses unsigned or forged events (400)', async () => {
    process.env.STRIPE_SECRET_KEY = 'rk_test_dummy';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    try {
      const { POST } = await import('@/app/api/payment/stripe/webhook/route');
      const db = fakeSupabase();
      const event = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { payment_status: 'paid', metadata: { premiumListingId: 'p1' } } } });
      expect((await POST(makeRequest('/api/payment/stripe/webhook', { method: 'POST', body: event }))).status).toBe(400);
      expect((await POST(makeRequest('/api/payment/stripe/webhook', { method: 'POST', body: event, headers: { 'stripe-signature': 't=1,v1=forged' } }))).status).toBe(400);
      expect(db.calls).toEqual([]);
    } finally {
      process.env.STRIPE_SECRET_KEY = '';
      process.env.STRIPE_WEBHOOK_SECRET = '';
    }
  });
});
