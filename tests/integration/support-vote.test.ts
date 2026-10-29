// RB-05: a guest vote from a /support link is held until the voter clicks the emailed link.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CROSS_SITE, makeRequest } from '../helpers';
import { fakeSupabase, type Call } from '../fake-supabase';

vi.mock('next/server', async importOriginal => ({ ...(await importOriginal<typeof import('next/server')>()), after: vi.fn() }));
vi.mock('@/lib/server/guest-email', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/server/guest-email')>()),
  domainAcceptsMail: vi.fn(async () => true),
}));
const { sendSupportVoteConfirm } = vi.hoisted(() => ({
  sendSupportVoteConfirm: vi.fn<(e: { to: string; confirmUrl: string }) => Promise<{ sent: true; id: string; from: string; to: string }>>(
    async () => ({ sent: true, id: 'm1', from: 'x', to: 'y' })
  ),
}));
vi.mock('@/lib/email', () => ({ sendSupportVoteConfirm }));

const LISTING = { id: 'l1', title: 'Product', location: 'https://example.com', total_votes: 3, created_at: '2026-10-01T00:00:00Z', rank_reached_at: '2026-10-01T00:00:00Z' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const VOTE = { listingId: 'l1', name: 'Jo Doe', email: 'Jo.Doe+rb@gmail.com', supportType: 'friend' };

describe('POST /api/support-vote', () => {
  beforeEach(() => sendSupportVoteConfirm.mockClear());

  it('holds the vote and emails a confirmation link instead of counting it', async () => {
    const { POST } = await import('@/app/api/support-vote/route');
    const fake = fakeSupabase(c => (c.table === 'listings' && c.method === 'GET' ? json([LISTING]) : undefined));
    const res = await POST(makeRequest('/api/support-vote', { method: 'POST', body: VOTE }));

    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ pending: true });
    expect(fake.calls.some(c => c.table === 'votes' && c.method === 'POST')).toBe(false);
    expect(fake.calls.some(c => c.table === 'supporters')).toBe(false);

    const pending = JSON.parse(fake.calls.find(c => c.table === 'pending_support_votes' && c.method === 'POST')!.body!);
    expect(pending).toMatchObject({ listing_id: 'l1', voter_id: 'email:jodoe@gmail.com', support_type: 'friend' });
    expect(pending.token_hash).toMatch(/^[0-9a-f]{64}$/);

    const link = sendSupportVoteConfirm.mock.calls[0][0].confirmUrl;
    const token = new URL(link).searchParams.get('token')!;
    expect(link).toContain('/support/confirm?token=');
    expect(pending.token_hash).not.toBe(token); // only the hash is stored
  });

  it('refuses an email that already has a counted vote, without sending anything', async () => {
    const { POST } = await import('@/app/api/support-vote/route');
    fakeSupabase(c => {
      if (c.table === 'listings' && c.method === 'GET') return json([LISTING]);
      if (c.table === 'votes' && c.method === 'GET') return json([{ id: 'v1' }]);
      return undefined;
    });
    const res = await POST(makeRequest('/api/support-vote', { method: 'POST', body: VOTE }));
    expect(res.status).toBe(409);
    expect(sendSupportVoteConfirm).not.toHaveBeenCalled();
  });
});

describe('POST /api/support-vote/confirm', () => {
  const pendingRow = { listing_id: 'l1', voter_id: 'email:jodoe@gmail.com', name: 'Jo Doe', email: 'jo.doe+rb@gmail.com', support_type: 'friend' };
  const db = (claimed: unknown[]) => fakeSupabase((c: Call) => {
    if (c.table === 'pending_support_votes' && c.method === 'PATCH') return json(claimed);
    if (c.table === 'listings' && c.method === 'GET') return json([LISTING]);
    if (c.table === 'votes' && c.method === 'POST') return new Response(null, { status: 201 });
    if (c.url.includes('rpc/refresh_listing_counts')) return json({ total_votes: 4, day_votes: 1 });
    return undefined;
  });

  it('counts the vote and saves the supporter once the link is used', async () => {
    const { POST } = await import('@/app/api/support-vote/confirm/route');
    const fake = db([pendingRow]);
    const res = await POST(makeRequest('/api/support-vote/confirm', { method: 'POST', body: { token: 'abc' } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ listingId: 'l1', name: 'Jo', totalVotes: 4 });
    expect(JSON.parse(fake.calls.find(c => c.table === 'votes' && c.method === 'POST')!.body!)).toMatchObject({ listing_id: 'l1', voter_id: 'email:jodoe@gmail.com' });
    expect(fake.calls.some(c => c.table === 'supporters' && c.method === 'POST')).toBe(true);
    // The token is claimed by its hash, only while unused and unexpired.
    const claim = fake.calls.find(c => c.table === 'pending_support_votes')!;
    expect(claim.url).toContain('used_at=is.null');
    expect(claim.url).not.toContain('token_hash=eq.abc');
  });

  it('refuses an unknown, used or expired link without counting anything', async () => {
    const { POST } = await import('@/app/api/support-vote/confirm/route');
    const fake = db([]);
    const res = await POST(makeRequest('/api/support-vote/confirm', { method: 'POST', body: { token: 'abc' } }));
    expect(res.status).toBe(400);
    expect(fake.calls.some(c => c.table === 'votes')).toBe(false);
  });

  it('refuses cross-site requests', async () => {
    const { POST } = await import('@/app/api/support-vote/confirm/route');
    const fake = db([pendingRow]);
    const res = await POST(makeRequest('/api/support-vote/confirm', { method: 'POST', body: { token: 'abc' }, headers: CROSS_SITE }));
    expect(res.status).toBe(403);
    expect(fake.calls).toEqual([]);
  });
});
