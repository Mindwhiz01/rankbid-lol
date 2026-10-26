import { NextRequest } from 'next/server';

export const ORIGIN = 'https://rankbid.click';

/** A NextRequest as the browser on rankbid.click would send it (same-site unless headers say otherwise). */
export function makeRequest(
  path: string,
  init: { method?: string; body?: unknown; cookies?: Record<string, string>; headers?: Record<string, string> } = {},
): NextRequest {
  const headers = new Headers({ host: 'rankbid.click', ...init.headers });
  if (init.cookies) {
    headers.set('cookie', Object.entries(init.cookies).map(([k, v]) => `${k}=${v}`).join('; '));
  }
  let body: string | undefined;
  if (init.body !== undefined) {
    body = typeof init.body === 'string' ? init.body : JSON.stringify(init.body);
    if (!headers.has('content-type')) headers.set('content-type', 'application/json');
  }
  return new NextRequest(new URL(path, ORIGIN), { method: init.method ?? 'GET', headers, body });
}

/** Headers a browser adds to a request another website triggered. */
export const CROSS_SITE = { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' };
