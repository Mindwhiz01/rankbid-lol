// Server-only: second sign-in step for admins. After the password, the dashboard emails a 6-digit code;
// entering it sets the admin_2fa cookie, which is bound to that sign-in's session token, so a stolen
// password alone never opens the admin. Nothing is stored: the pending code lives in a signed cookie.
import { createHash, createHmac, randomInt, timingSafeEqual } from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';

export const ADMIN_2FA_COOKIE = 'admin_2fa';
const CHALLENGE_COOKIE = 'admin_2fa_challenge';
const CODE_TTL_MS = 10 * 60 * 1000;
const PROOF_MAX_AGE_SEC = 12 * 60 * 60;

function secret(): string {
  const s = process.env.ADMIN_2FA_SECRET || process.env.ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error('No secret configured for admin sign-in codes');
  return s;
}

const sign = (data: string) => createHmac('sha256', secret()).update(data).digest('hex');

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Short, non-secret handle for a session token (for rate-limit keys). */
export function sessionHandle(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 24);
}

/** True when this request's session has passed the emailed-code step (and the proof is under 12 hours old). */
export function hasAdminSecondFactor(req: NextRequest): boolean {
  const token = req.cookies.get('auth_token')?.value;
  const proof = req.cookies.get(ADMIN_2FA_COOKIE)?.value;
  if (!token || !proof) return false;
  const [issued, mac] = proof.split('.');
  const at = Number(issued);
  if (!at || !mac || Date.now() - at > PROOF_MAX_AGE_SEC * 1000) return false;
  try {
    return safeEqual(mac, sign(`proof:${token}:${at}`));
  } catch {
    return false;
  }
}

/** A fresh code for this session; the caller emails it. The response carries the signed challenge. */
export function startChallenge(res: NextResponse, token: string): string {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const exp = Date.now() + CODE_TTL_MS;
  res.cookies.set(CHALLENGE_COOKIE, `${exp}.${sign(`code:${token}:${code}:${exp}`)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: CODE_TTL_MS / 1000,
    path: '/',
  });
  return code;
}

/** Checks `code` against this session's pending challenge. */
export function codeMatches(req: NextRequest, token: string, code: string): boolean {
  const challenge = req.cookies.get(CHALLENGE_COOKIE)?.value;
  if (!challenge || !/^\d{6}$/.test(code)) return false;
  const [expRaw, mac] = challenge.split('.');
  const exp = Number(expRaw);
  if (!exp || !mac || Date.now() > exp) return false;
  return safeEqual(mac, sign(`code:${token}:${code}:${exp}`));
}

/** Marks this session as having passed the second step, and clears the used challenge. */
export function grantSecondFactor(res: NextResponse, token: string): void {
  const at = Date.now();
  res.cookies.set(ADMIN_2FA_COOKIE, `${at}.${sign(`proof:${token}:${at}`)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: PROOF_MAX_AGE_SEC,
    path: '/',
  });
  res.cookies.delete(CHALLENGE_COOKIE);
}

export function clearSecondFactor(res: NextResponse): void {
  res.cookies.delete(ADMIN_2FA_COOKIE);
  res.cookies.delete(CHALLENGE_COOKIE);
}
