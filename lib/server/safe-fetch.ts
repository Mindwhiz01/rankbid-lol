// Server-only fetch for user-supplied URLs. Blocks requests to private, loopback, link-local and
// cloud-metadata addresses (SSRF), re-checking every redirect hop.
import { lookup } from 'dns/promises';
import { isIP } from 'net';

export class UnsafeUrlError extends Error {}

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) || // link-local, incl. cloud metadata 169.254.169.254
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (isIP(ip) !== 6) return true;
  const h = expandIpv6(ip);
  const v4 = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  // IPv4 carried inside IPv6 (mapped ::ffff:a.b.c.d, compatible ::a.b.c.d, NAT64 64:ff9b::, 6to4 2002::).
  // The URL parser rewrites [::ffff:127.0.0.1] as [::ffff:7f00:1], so the hex form has to be decoded too.
  if (h.slice(0, 5).every(x => x === 0) && (h[5] === 0xffff || h[5] === 0)) {
    return h[5] === 0 && h[6] === 0 ? true : isPrivateIp(v4(h[6], h[7])); // ::, ::1 and other ::/96 addresses
  }
  if (h[0] === 0x64 && h[1] === 0xff9b) return isPrivateIp(v4(h[6], h[7]));
  if (h[0] === 0x2002) return isPrivateIp(v4(h[1], h[2]));
  return (h[0] & 0xfe00) === 0xfc00 || (h[0] & 0xffc0) === 0xfe80 || (h[0] & 0xff00) === 0xff00; // ULA, link-local, multicast
}

/** The eight 16-bit groups of an IPv6 address (expands "::" and a trailing dotted IPv4 part). */
function expandIpv6(ip: string): number[] {
  let s = ip.toLowerCase().split('%')[0];
  const dotted = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted[1].split('.').map(Number);
    s = s.slice(0, -dotted[1].length) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = s.split('::');
  const left = head ? head.split(':') : [];
  const right = tail !== undefined && tail ? tail.split(':') : [];
  const fill = tail !== undefined ? Array(8 - left.length - right.length).fill('0') : [];
  return [...left, ...fill, ...right].map(x => parseInt(x, 16) || 0);
}

/** Throws UnsafeUrlError unless `raw` is an http(s) URL on a standard port that resolves to public IPs only. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new UnsafeUrlError('Only http(s) URLs are allowed');
  if (url.username || url.password) throw new UnsafeUrlError('URLs with credentials are not allowed');
  if (url.port && url.port !== '80' && url.port !== '443') throw new UnsafeUrlError('Non-standard ports are not allowed');

  const host = url.hostname.replace(/^\[|\]$/g, '');
  let addresses: string[];
  try {
    addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  } catch {
    throw new UnsafeUrlError('Host could not be resolved');
  }
  if (addresses.length === 0 || addresses.some(isPrivateIp)) throw new UnsafeUrlError('Private addresses are not allowed');
  return url;
}

/** fetch() for untrusted URLs: SSRF-checked, manual redirects (max 3), 8s timeout. */
export async function safeFetch(raw: string, init: RequestInit = {}, maxRedirects = 3): Promise<Response> {
  let current = raw;
  for (let hop = 0; ; hop++) {
    const url = await assertPublicUrl(current);
    const res = await fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(8000) });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      if (hop >= maxRedirects) throw new UnsafeUrlError('Too many redirects');
      current = new URL(location, url).toString();
      continue;
    }
    return res;
  }
}

/** Reads at most `maxBytes` of a response body as text. */
export async function readTextLimited(res: Response, maxBytes = 1_000_000): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, maxBytes));
}
