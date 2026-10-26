import { describe, expect, it } from 'vitest';
import { NextResponse } from 'next/server';
import { createSessionToken, getSessionUser, isCrossSiteWrite } from '@/lib/server/session';
import { ADMIN_2FA_COOKIE, codeMatches, grantSecondFactor, hasAdminSecondFactor, startChallenge } from '@/lib/server/admin-2fa';
import { CROSS_SITE, makeRequest } from '../helpers';

describe('createSessionToken', () => {
  it('is long, random and URL-safe', () => {
    const a = createSessionToken();
    const b = createSessionToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^session_[A-Za-z0-9_-]{43}$/);
  });
});

describe('isCrossSiteWrite (CSRF guard)', () => {
  it('refuses a POST another site triggered', () => {
    expect(isCrossSiteWrite(makeRequest('/api/votes', { method: 'POST', headers: CROSS_SITE }))).toBe(true);
  });

  it('refuses a POST from a foreign Origin when Sec-Fetch-Site is missing', () => {
    expect(isCrossSiteWrite(makeRequest('/api/votes', { method: 'POST', headers: { origin: 'https://evil.example' } }))).toBe(true);
  });

  it('allows same-site writes, reads, and scripts without browser headers', () => {
    expect(isCrossSiteWrite(makeRequest('/api/votes', { method: 'POST', headers: { 'sec-fetch-site': 'same-origin' } }))).toBe(false);
    expect(isCrossSiteWrite(makeRequest('/api/votes', { method: 'GET', headers: CROSS_SITE }))).toBe(false);
    expect(isCrossSiteWrite(makeRequest('/api/votes', { method: 'POST' }))).toBe(false);
  });

  it('gives a cross-site write no session, even with the cookie', async () => {
    const req = makeRequest('/api/votes', { method: 'POST', headers: CROSS_SITE, cookies: { auth_token: 'session_x' } });
    await expect(getSessionUser(req)).resolves.toBeNull();
  });
});

/** Cookies a response set, as a request cookie map. */
function cookiesOf(res: NextResponse): Record<string, string> {
  return Object.fromEntries(res.cookies.getAll().filter(c => c.value).map(c => [c.name, c.value]));
}

describe('admin second factor', () => {
  const token = 'session_admin';

  it('accepts the emailed code once for the session it was sent to', () => {
    const res = NextResponse.json({});
    const code = startChallenge(res, token);
    expect(code).toMatch(/^\d{6}$/);
    const req = makeRequest('/api/admin/session', { cookies: { auth_token: token, ...cookiesOf(res) } });
    expect(codeMatches(req, token, code)).toBe(true);
    expect(codeMatches(req, token, code === '000000' ? '000001' : '000000')).toBe(false);
    expect(codeMatches(req, 'session_other', code)).toBe(false);
  });

  it('binds the proof cookie to the session token', () => {
    const res = NextResponse.json({});
    grantSecondFactor(res, token);
    const proof = cookiesOf(res)[ADMIN_2FA_COOKIE];
    expect(hasAdminSecondFactor(makeRequest('/admin', { cookies: { auth_token: token, [ADMIN_2FA_COOKIE]: proof } }))).toBe(true);
    // A proof copied to another session, or a forged one, doesn't count.
    expect(hasAdminSecondFactor(makeRequest('/admin', { cookies: { auth_token: 'session_stolen', [ADMIN_2FA_COOKIE]: proof } }))).toBe(false);
    expect(hasAdminSecondFactor(makeRequest('/admin', { cookies: { auth_token: token, [ADMIN_2FA_COOKIE]: `${Date.now()}.deadbeef` } }))).toBe(false);
    expect(hasAdminSecondFactor(makeRequest('/admin', { cookies: { auth_token: token } }))).toBe(false);
  });

  it('expires the proof after 12 hours', () => {
    const old = Date.now() - 13 * 60 * 60 * 1000;
    const res = NextResponse.json({});
    const realNow = Date.now;
    Date.now = () => old;
    try {
      grantSecondFactor(res, token);
    } finally {
      Date.now = realNow;
    }
    const proof = cookiesOf(res)[ADMIN_2FA_COOKIE];
    expect(hasAdminSecondFactor(makeRequest('/admin', { cookies: { auth_token: token, [ADMIN_2FA_COOKIE]: proof } }))).toBe(false);
  });
});
