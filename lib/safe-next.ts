// Where to send someone after sign-in, sign-up or email confirmation (?next=…): a path on this site only.

const BASE = 'https://rankbid.invalid';

/**
 * `raw` as a same-site path ("/sponsor?listing=1"), or `fallback`. Checked by resolving it the way the
 * browser will: "/\evil.com" and "/<tab>/evil.com" look like paths but open evil.com.
 */
export function safeNextPath(raw: string | null | undefined, fallback: string): string {
  if (!raw || !raw.startsWith('/')) return fallback;
  try {
    const url = new URL(raw, BASE);
    return url.origin === BASE ? url.pathname + url.search + url.hash : fallback;
  } catch {
    return fallback;
  }
}
