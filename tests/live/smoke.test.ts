// Read-only checks against a deployed site: BASE_URL=https://rankbid-sandbox-mindwhiz.vercel.app npm run test:live
// Every request is a GET or a refused write, so it is safe to run against production.
import { describe, expect, it } from 'vitest';

const BASE = (process.env.BASE_URL || '').replace(/\/+$/, '');
const get = (path: string, init?: RequestInit) => fetch(`${BASE}${path}`, { redirect: 'manual', ...init });

describe(`live site ${BASE}`, () => {
  it('serves the public listings API', async () => {
    const res = await get('/api/listings/submit?pageSize=1');
    expect(res.status).toBe(200);
    expect(Array.isArray((await res.json()).listings)).toBe(true);
  });

  it.each([
    '/api/auth/me',
    '/api/user/profile',
    '/api/user/votes',
    '/api/user/submissions',
    '/api/user/password',
    '/api/premium-listings/status?id=x',
  ])('%s needs a sign-in (401)', async path => {
    expect((await get(path)).status).toBe(401);
  });

  it.each(['/api/admin/users', '/api/admin/listings', '/api/admin/sponsored', '/api/admin/votes', '/api/admin/live'])(
    '%s needs an admin (401)',
    async path => {
      expect((await get(path)).status).toBe(401);
    },
  );

  it('the owner-only activity log is refused (403)', async () => {
    expect((await get('/api/admin/activity')).status).toBe(403);
  });

  it('a forged session cookie is not a sign-in', async () => {
    expect((await get('/api/auth/me', { headers: { cookie: 'auth_token=session_forged; admin_2fa=1.abc' } })).status).toBe(401);
    expect((await get('/api/admin/users', { headers: { cookie: 'auth_token=session_forged; admin_2fa=1.abc' } })).status).toBe(401);
  });

  it('cron refuses requests without its secret', async () => {
    expect((await get('/api/cron/reset-daily-votes')).status).toBe(401);
  });

  it('the Stripe webhook refuses unsigned events', async () => {
    const res = await get('/api/payment/stripe/webhook', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
    expect([400, 500]).toContain(res.status);
  });

  it('cross-site sign-in posts are refused', async () => {
    const res = await get('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@example.com', password: 'x' }),
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' },
    });
    expect(res.status).toBe(403);
  });

  it('an injected platform filter is ignored', async () => {
    // With a real filter alongside, the bad value is dropped (0 rows). Injected, "id.neq.0" would match every row.
    const injected = await (await get(`/api/listings/submit?pageSize=100&platform=nothing&platform=${encodeURIComponent('nothing,id.neq.0')}`)).json();
    expect(injected.listings).toEqual([]);
  });

  it('sends the security headers', async () => {
    const res = await get('/robots.txt');
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('strict-transport-security')).toContain('max-age=');
  });
});
