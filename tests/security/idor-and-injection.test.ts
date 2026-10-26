// Regression tests: users can only touch their own records, and query parameters can't add
// database filters of their own.
import { describe, expect, it } from 'vitest';
import { makeRequest } from '../helpers';
import { fakeSupabase, MEMBER, OTHER, tokenFor } from '../fake-supabase';

const asMember = { auth_token: tokenFor(MEMBER) };

describe("no access to another user's records (IDOR)", () => {
  it("deleting someone else's submission finds nothing and deletes nothing", async () => {
    const { DELETE } = await import('@/app/api/user/submissions/route');
    const db = fakeSupabase();
    const res = await DELETE(makeRequest('/api/user/submissions', { method: 'DELETE', body: { listingId: 'listing-of-other' }, cookies: asMember }));
    expect(res.status).toBe(404);
    // The ownership lookup is scoped to the session's account, whatever id the browser sends.
    const lookup = db.calls.find(c => c.table === 'listings');
    expect(lookup?.url).toContain(`user_id=eq.${MEMBER.id}`);
    expect(db.writes()).toEqual([]);
  });

  it("editing someone else's submission only ever matches the caller's own rows", async () => {
    const { PATCH } = await import('@/app/api/user/submissions/route');
    const db = fakeSupabase();
    const res = await PATCH(makeRequest('/api/user/submissions', { method: 'PATCH', body: { listingId: 'listing-of-other', title: 'Hijacked', userId: OTHER.id }, cookies: asMember }));
    expect(res.status).toBe(404);
    const update = db.calls.find(c => c.table === 'listings' && c.method === 'PATCH');
    expect(update?.url).toContain(`user_id=eq.${MEMBER.id}`);
    expect(update?.url).not.toContain(OTHER.id);
  });

  it('own data endpoints ignore a user id in the query', async () => {
    const { GET } = await import('@/app/api/user/votes/route');
    const db = fakeSupabase();
    const res = await GET(makeRequest(`/api/user/votes?userId=${OTHER.id}`, { cookies: asMember }));
    expect(res.status).toBe(200);
    const votes = db.calls.find(c => c.table === 'user_votes');
    expect(votes?.url).toContain(`user_id=eq.${MEMBER.id}`);
    expect(db.calls.some(c => c.url.includes(OTHER.id))).toBe(false);
  });

  it("can't read the payment status of someone else's sponsorship", async () => {
    const { GET } = await import('@/app/api/premium-listings/status/route');
    fakeSupabase(c => {
      if (c.table === 'premium_listings') return Response.json([{ id: 'p1', listing_id: 'l1', payment_status: 'active', payment_txn_ref: 'pi_1' }]);
      if (c.table === 'listings') return Response.json([{ user_id: OTHER.id, title: 'Theirs' }]);
      return undefined;
    });
    const res = await GET(makeRequest('/api/premium-listings/status?id=p1&txn=pi_1', { cookies: asMember }));
    expect(res.status).toBe(404);
  });

  it("can't buy a sponsorship for someone else's product", async () => {
    process.env.STRIPE_SECRET_KEY = 'rk_test_dummy';
    try {
      const { POST } = await import('@/app/api/premium-listings/checkout/route');
      const db = fakeSupabase(c => (c.table === 'listings' ? Response.json([{ id: 'l1', user_id: OTHER.id }]) : undefined));
      const res = await POST(makeRequest('/api/premium-listings/checkout', {
        method: 'POST',
        cookies: asMember,
        body: { items: [{ listingId: 'l1', bidUsd: 5, founderName: 'Mallory', founderEmail: 'm@example.com', founderPhone: '+15555550100' }] },
      }));
      expect(res.status).toBe(403);
      expect(db.writes()).toEqual([]);
    } finally {
      process.env.STRIPE_SECRET_KEY = '';
    }
  });
});

describe('PostgREST filter injection', () => {
  it.each([
    'x,id.neq.0',
    'x),or(id.neq.0',
    'website&select=*',
    'twitter.eq.x,user_id.not.is.null',
  ])('?platform=%s is dropped instead of reaching the database', async platform => {
    const { GET } = await import('@/app/api/listings/submit/route');
    const db = fakeSupabase();
    const res = await GET(makeRequest(`/api/listings/submit?platform=${encodeURIComponent(platform)}&platform=website`));
    expect(res.status).toBe(200);
    const query = db.calls.find(c => c.table === 'listings')!.url;
    expect(query).toContain('or=(platform.eq.website)');
    expect(query).not.toMatch(/id\.neq|user_id|select=\*/);
  });
});

describe('error responses stay generic', () => {
  it('filtered-stats does not echo database errors', async () => {
    const { GET } = await import('@/app/api/analytics/filtered-stats/route');
    fakeSupabase(() => new Response(JSON.stringify({ message: 'relation "secret_table" does not exist', code: '42P01' }), { status: 400, headers: { 'content-type': 'application/json' } }));
    const res = await GET(new Request('https://rankbid.click/api/analytics/filtered-stats?period=daily'));
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(text).not.toContain('secret_table');
  });
});
