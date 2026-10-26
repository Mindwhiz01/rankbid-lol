// Regression tests for the admin dashboard API: admin needs an admin account AND this session's
// emailed code; team admins can't use owner-only actions.
import { describe, expect, it } from 'vitest';
import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_2FA_COOKIE, grantSecondFactor } from '@/lib/server/admin-2fa';
import { makeRequest } from '../helpers';
import { fakeSupabase, MEMBER, OWNER, TEAM_ADMIN, tokenFor } from '../fake-supabase';

type Handler = (req: NextRequest) => Promise<Response>;
type Case = [name: string, load: () => Promise<Handler>, method: string, body?: unknown];

const admin: Case[] = [
  ['activity GET', async () => (await import('@/app/api/admin/activity/route')).GET, 'GET'],
  ['email-domain GET', async () => (await import('@/app/api/admin/email-domain/route')).GET, 'GET'],
  ['email-domain POST', async () => (await import('@/app/api/admin/email-domain/route')).POST, 'POST', {}],
  ['listings GET', async () => (await import('@/app/api/admin/listings/route')).GET, 'GET'],
  ['listings PATCH', async () => (await import('@/app/api/admin/listings/route')).PATCH, 'PATCH', { listingId: 'l1', title: 'x' }],
  ['listings DELETE', async () => (await import('@/app/api/admin/listings/route')).DELETE, 'DELETE', { listingId: 'l1' }],
  ['live GET', async () => (await import('@/app/api/admin/live/route')).GET, 'GET'],
  ['premium-listings GET', async () => (await import('@/app/api/admin/premium-listings/route')).GET, 'GET'],
  ['premium-listings PATCH', async () => (await import('@/app/api/admin/premium-listings/route')).PATCH, 'PATCH', { premiumListingId: 'p1', status: 'approved' }],
  ['site-settings GET', async () => (await import('@/app/api/admin/site-settings/route')).GET, 'GET'],
  ['site-settings PATCH', async () => (await import('@/app/api/admin/site-settings/route')).PATCH, 'PATCH', { comingSoon: false, confirm: 'LAUNCH' }],
  ['sponsored GET', async () => (await import('@/app/api/admin/sponsored/route')).GET, 'GET'],
  ['team GET', async () => (await import('@/app/api/admin/team/route')).GET, 'GET'],
  ['team POST', async () => (await import('@/app/api/admin/team/route')).POST, 'POST', { email: 'new@example.com' }],
  ['team PATCH', async () => (await import('@/app/api/admin/team/route')).PATCH, 'PATCH', { email: TEAM_ADMIN.email }],
  ['team DELETE', async () => (await import('@/app/api/admin/team/route')).DELETE, 'DELETE', { email: TEAM_ADMIN.email }],
  ['test-email POST', async () => (await import('@/app/api/admin/test-email/route')).POST, 'POST', {}],
  ['users GET', async () => (await import('@/app/api/admin/users/route')).GET, 'GET'],
  ['users PATCH', async () => (await import('@/app/api/admin/users/route')).PATCH, 'PATCH', { userId: MEMBER.id, name: 'x' }],
  ['users DELETE', async () => (await import('@/app/api/admin/users/route')).DELETE, 'DELETE', { userId: MEMBER.id }],
  ['users/block POST', async () => (await import('@/app/api/admin/users/block/route')).POST, 'POST', { userId: MEMBER.id, blocked: true }],
  ['votes GET', async () => (await import('@/app/api/admin/votes/route')).GET, 'GET'],
  ['votes DELETE', async () => (await import('@/app/api/admin/votes/route')).DELETE, 'DELETE', { voteIds: ['v1'], reason: 'x' }],
];

/** The admin_2fa cookie a session gets after entering its emailed code. */
function proofFor(token: string): string {
  const res = NextResponse.json({});
  grantSecondFactor(res, token);
  return res.cookies.get(ADMIN_2FA_COOKIE)!.value;
}

const call = async (load: () => Promise<Handler>, method: string, body: unknown, cookies?: Record<string, string>) =>
  (await load())(makeRequest('/api/admin/x', { method, body, cookies }));

describe('admin API refuses everyone who is not a verified admin', () => {
  it.each(admin)('%s: anonymous', async (_n, load, method, body) => {
    const db = fakeSupabase();
    expect([401, 403]).toContain((await call(load, method, body)).status);
    expect(db.dataCalls()).toEqual([]);
  });

  it.each(admin)('%s: an ordinary member, even with a proof cookie of their own', async (_n, load, method, body) => {
    const db = fakeSupabase();
    const token = tokenFor(MEMBER);
    expect([401, 403]).toContain((await call(load, method, body, { auth_token: token, [ADMIN_2FA_COOKIE]: proofFor(token) })).status);
    expect(db.dataCalls()).toEqual([]);
  });

  it.each(admin)('%s: the owner before entering the emailed code', async (_n, load, method, body) => {
    const db = fakeSupabase();
    expect([401, 403]).toContain((await call(load, method, body, { auth_token: tokenFor(OWNER) })).status);
    expect(db.dataCalls()).toEqual([]);
  });

  it.each(admin)("%s: the owner's code proof replayed on another session", async (_n, load, method, body) => {
    const db = fakeSupabase();
    const stolen = proofFor(tokenFor(OWNER));
    expect([401, 403]).toContain((await call(load, method, body, { auth_token: tokenFor(TEAM_ADMIN), [ADMIN_2FA_COOKIE]: stolen })).status);
    expect(db.dataCalls()).toEqual([]);
  });
});

describe('owner-only actions refuse a verified team admin (403)', () => {
  const ownerOnly = admin.filter(([n]) => ['activity GET', 'team POST', 'team PATCH', 'team DELETE', 'site-settings PATCH'].includes(n));

  it.each(ownerOnly)('%s', async (_n, load, method, body) => {
    const db = fakeSupabase();
    const token = tokenFor(TEAM_ADMIN);
    const res = await call(load, method, body, { auth_token: token, [ADMIN_2FA_COOKIE]: proofFor(token) });
    expect(res.status).toBe(403);
    expect(db.writes()).toEqual([]);
  });

  it('a team admin cannot block, edit or delete the owner', async () => {
    const token = tokenFor(TEAM_ADMIN);
    const cookies = { auth_token: token, [ADMIN_2FA_COOKIE]: proofFor(token) };
    for (const [load, method, body] of [
      [async () => (await import('@/app/api/admin/users/block/route')).POST, 'POST', { userId: OWNER.id, blocked: true }],
      [async () => (await import('@/app/api/admin/users/route')).PATCH, 'PATCH', { userId: OWNER.id, password: 'takeover123' }],
      [async () => (await import('@/app/api/admin/users/route')).DELETE, 'DELETE', { userId: OWNER.id }],
    ] as const) {
      const db = fakeSupabase(c => (c.table === 'users' && c.url.includes(`id=eq.${OWNER.id}`) && c.url.includes('select=id,email,name,password')
        ? new Response(JSON.stringify([{ ...OWNER, password: 'hash' }]), { headers: { 'content-type': 'application/json' } })
        : undefined));
      const res = await call(load, method, body, cookies);
      expect(res.status).toBe(403);
      expect(db.writes()).toEqual([]);
    }
  });
});

describe('a verified owner gets in (the tests above refuse for the right reason)', () => {
  it('team GET answers 200 for the owner with the code proof', async () => {
    fakeSupabase();
    const token = tokenFor(OWNER);
    const { GET } = await import('@/app/api/admin/team/route');
    const res = await GET(makeRequest('/api/admin/team', { cookies: { auth_token: token, [ADMIN_2FA_COOKIE]: proofFor(token) } }));
    expect(res.status).toBe(200);
    expect((await res.json()).canManage).toBe(true);
  });
});
