// Business logic of the hottest API paths, against the fake Supabase: what gets written, what the caller
// gets back, and how many database round trips it takes (a latency regression guard).
import bcryptjs from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers';
import { fakeSupabase, MEMBER, tokenFor, type Call } from '../fake-supabase';

// after() needs a live Next.js request; the vote notifications it schedules aren't under test here.
vi.mock('next/server', async importOriginal => ({ ...(await importOriginal<typeof import('next/server')>()), after: vi.fn() }));

const asMember = { auth_token: tokenFor(MEMBER) };
const LISTING = { id: 'l1', title: 'Product', location: 'https://example.com', total_votes: 3, created_at: '2026-10-01T00:00:00Z', rank_reached_at: '2026-10-01T00:00:00Z' };
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

describe('POST /api/votes', () => {
  let votesInsert: (c: Call) => Response;
  beforeEach(() => {
    votesInsert = () => new Response(null, { status: 201 });
  });
  const db = () => fakeSupabase(c => {
    if (c.table === 'listings' && c.method === 'GET') return json([LISTING]);
    if (c.table === 'votes' && c.method === 'POST') return votesInsert(c);
    if (c.table === 'votes' && c.method === 'GET') return json([], 200, { 'content-range': '0-0/4' });
    if (c.url.includes('rpc/refresh_listing_counts')) return json({ total_votes: 4, day_votes: 1 });
    return undefined;
  });

  it("records the session's vote (never an id from the body) and returns the new count", async () => {
    const { POST } = await import('@/app/api/votes/route');
    const fake = db();
    const res = await POST(makeRequest('/api/votes', { method: 'POST', body: { listingId: 'l1', userId: 'someone-else', voterId: 'x' }, cookies: asMember }));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ success: true, voted: true, totalVotes: 4 });

    const vote = JSON.parse(fake.calls.find(c => c.table === 'votes' && c.method === 'POST')!.body!);
    expect(vote).toMatchObject({ listing_id: 'l1', voter_id: `user:${MEMBER.id}` });
    const userVote = JSON.parse(fake.calls.find(c => c.table === 'user_votes' && c.method === 'POST')!.body!);
    expect(userVote).toMatchObject({ user_id: MEMBER.id, listing_id: 'l1' });
  });

  // Before the 2026-10-26 tuning a vote took 17 calls in 16 sequential steps.
  it('takes at most 10 database calls, in 6 sequential steps', async () => {
    const { POST } = await import('@/app/api/votes/route');
    const fake = db();
    await POST(makeRequest('/api/votes', { method: 'POST', body: { listingId: 'l1' }, cookies: asMember }));
    // session · 3 rate limits ∥ · listing, user vote, snapshot ∥ · insert · locked recount (RPC) · user_votes
    expect(fake.calls.length).toBeLessThanOrEqual(10);
    expect(fake.calls.filter(c => c.table === 'rate_limits')).toEqual([]); // one RPC each, not insert+count
    expect(fake.calls.some(c => c.table === 'listings' && c.method === 'PATCH')).toBe(false); // RB-34: saved by the RPC
  });

  it('falls back to count-then-save when refresh_listing_counts is not installed', async () => {
    const { POST } = await import('@/app/api/votes/route');
    const fake = fakeSupabase(c => {
      if (c.table === 'listings' && c.method === 'GET') return json([LISTING]);
      if (c.table === 'votes' && c.method === 'POST') return new Response(null, { status: 201 });
      if (c.table === 'votes' && c.method === 'GET') return json([], 200, { 'content-range': '0-0/4' });
      if (c.url.includes('rpc/refresh_listing_counts')) return json({ code: 'PGRST202' }, 404);
      return undefined;
    });
    const res = await POST(makeRequest('/api/votes', { method: 'POST', body: { listingId: 'l1' }, cookies: asMember }));
    expect(await res.json()).toMatchObject({ totalVotes: 4 });
    expect(fake.calls.some(c => c.table === 'listings' && c.method === 'PATCH')).toBe(true);
  });

  it('a second vote from the same account is refused by the unique index (409 → "Already voted")', async () => {
    const { POST } = await import('@/app/api/votes/route');
    votesInsert = () => json({ code: '23505' }, 409);
    const fake = db();
    const res = await POST(makeRequest('/api/votes', { method: 'POST', body: { listingId: 'l1' }, cookies: asMember }));
    expect(res.status).toBe(400);
    expect((await res.json()).voted).toBe(true);
    expect(fake.calls.some(c => c.table === 'listings' && c.method === 'PATCH')).toBe(false);
  });

  it('is refused when a rate limit is hit (429), before any vote is written', async () => {
    const { POST } = await import('@/app/api/votes/route');
    const fake = fakeSupabase(c => (c.table === 'rpc' && c.body?.includes('vote-user:') ? json(false) : c.table === 'listings' ? json([LISTING]) : undefined));
    const res = await POST(makeRequest('/api/votes', { method: 'POST', body: { listingId: 'l1' }, cookies: asMember }));
    expect(res.status).toBe(429);
    expect(fake.writes()).toEqual([]);
  });

  it('answers 404 for an unknown listing', async () => {
    const { POST } = await import('@/app/api/votes/route');
    fakeSupabase();
    const res = await POST(makeRequest('/api/votes', { method: 'POST', body: { listingId: 'missing' }, cookies: asMember }));
    expect(res.status).toBe(404);
  });
});

describe('rateLimit', () => {
  it('uses the one-call rate_limit_hit RPC', async () => {
    const { rateLimit } = await import('@/lib/server/rate-limit');
    const fake = fakeSupabase(c => (c.table === 'rpc' ? json(false) : undefined));
    expect(await rateLimit('test:abc', 3, 60)).toBe(false);
    expect(fake.calls.map(c => `${c.method} ${c.table}`)).toEqual(['POST rpc']);
    expect(JSON.parse(fake.calls[0].body!)).toEqual({ p_key: 'test:abc', p_limit: 3, p_window_sec: 60 });
  });

  it('falls back to insert + count when the function is missing (404)', async () => {
    const { rateLimit } = await import('@/lib/server/rate-limit');
    const fake = fakeSupabase(c => {
      if (c.table === 'rpc') return json({ code: 'PGRST202' }, 404);
      if (c.table === 'rate_limits' && c.method === 'HEAD') return new Response(null, { headers: { 'content-range': '0-0/5' } });
      return undefined;
    });
    expect(await rateLimit('test:abc', 3, 60)).toBe(false);
    expect(fake.calls.map(c => `${c.method} ${c.table}`)).toEqual(['POST rpc', 'POST rate_limits', 'HEAD rate_limits', 'DELETE rate_limits']);
  });

  it('fails open on a database error, so an outage never blocks the site', async () => {
    const { rateLimit } = await import('@/lib/server/rate-limit');
    fakeSupabase(c => (c.table === 'rpc' ? json({ message: 'boom' }, 500) : undefined));
    expect(await rateLimit('test:abc', 3, 60)).toBe(true);
  });
});

describe('POST /api/auth/login', () => {
  const hash = bcryptjs.hashSync('correct-horse', 4);
  const account = (extra: Record<string, unknown> = {}) => fakeSupabase(c => {
    if (c.table === 'users' && c.url.includes(`email=eq.${MEMBER.email}`)) return json([{ ...MEMBER, password: hash }]);
    if (c.table === 'users' && c.url.includes(`id=eq.${MEMBER.id}`)) return json([{ ...MEMBER, email_verified_at: '2026-10-01', blocked_at: null, ...extra }]);
    return undefined;
  });
  const login = async (password: string) => {
    const { POST } = await import('@/app/api/auth/login/route');
    return POST(makeRequest('/api/auth/login', { method: 'POST', body: { email: MEMBER.email.toUpperCase(), password } }));
  };

  it('signs in with a 30-day httpOnly, SameSite=Lax session cookie', async () => {
    const fake = account();
    const res = await login('correct-horse');
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie') || '';
    expect(cookie).toMatch(/auth_token=session_[A-Za-z0-9_-]{43}/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Max-Age=2592000/);
    const session = JSON.parse(fake.calls.find(c => c.table === 'sessions' && c.method === 'POST')!.body!);
    expect(session.user_id).toBe(MEMBER.id);
    expect(cookie).toContain(session.token);
  });

  it('gives the same answer for a wrong password and an unknown email (401)', async () => {
    account();
    const wrong = await login('wrong-password');
    fakeSupabase();
    const unknown = await login('correct-horse');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
    expect(wrong.headers.get('set-cookie')).toBeNull();
  });

  it('refuses blocked and unconfirmed accounts (403) without creating a session', async () => {
    for (const extra of [{ blocked_at: '2026-10-02' }, { email_verified_at: null }]) {
      const fake = account(extra);
      const res = await login('correct-horse');
      expect(res.status).toBe(403);
      expect(fake.calls.some(c => c.table === 'sessions' && c.method === 'POST')).toBe(false);
    }
  });
});
