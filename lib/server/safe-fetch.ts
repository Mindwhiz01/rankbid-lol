// Server-only fetch for user-supplied URLs. Blocks requests to private, loopback, link-local and
// cloud-metadata addresses (SSRF), re-checking every redirect hop. The connection goes to the exact
// address that was checked, so a DNS answer that changes between the check and the fetch (DNS
// rebinding) can't point it at an internal host.
import { lookup } from 'dns/promises';
import http from 'node:http';
import https from 'node:https';
import { pipeline, Readable } from 'node:stream';
import zlib from 'node:zlib';
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
  return (await resolvePublic(raw)).url;
}

/** The checked URL plus the public address it resolved to (the one the request must connect to). */
async function resolvePublic(raw: string): Promise<{ url: URL; address: string }> {
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
  return { url, address: addresses[0] };
}

const TIMEOUT_MS = 8000;

/** One HTTP(S) request connected to `address` (TLS still checks the certificate for the URL's host). */
function pinnedRequest(url: URL, address: string, init: { method?: string; headers?: HeadersInit }): Promise<Response> {
  const family = isIP(address);
  return new Promise((resolve, reject) => {
    const req = (url.protocol === 'https:' ? https : http).request(url, {
      method: init.method || 'GET',
      headers: { ...Object.fromEntries(new Headers(init.headers)), 'accept-encoding': 'gzip, deflate, br' },
      lookup: (_host, opts, cb) => (opts.all ? cb(null, [{ address, family }]) : (cb as (e: null, a: string, f: number) => void)(null, address, family)),
    }, res => {
      const status = res.statusCode ?? 502;
      const headers = new Headers();
      for (const [k, v] of Object.entries(res.headers)) if (v != null) headers.set(k, Array.isArray(v) ? v.join(', ') : String(v));
      const encoding = (res.headers['content-encoding'] || '').toLowerCase();
      // Lenient flushing (as browsers do), so a body cut short still yields what arrived.
      const decoder = encoding === 'gzip' || encoding === 'x-gzip' ? zlib.createGunzip({ finishFlush: zlib.constants.Z_SYNC_FLUSH })
        : encoding === 'deflate' ? zlib.createInflate({ finishFlush: zlib.constants.Z_SYNC_FLUSH })
        : encoding === 'br' ? zlib.createBrotliDecompress({ finishFlush: zlib.constants.BROTLI_OPERATION_FLUSH })
        : null;
      if (decoder) headers.delete('content-encoding');
      // pipeline() owns the errors: a broken body ends the stream instead of crashing the process.
      const stream = decoder ? pipeline(res, decoder, () => {}) : res;
      res.on('error', () => {});
      const noBody = init.method === 'HEAD' || status === 204 || status === 304;
      if (noBody) res.resume();
      resolve(new Response(noBody ? null : (Readable.toWeb(stream) as ReadableStream), { status: status >= 200 && status <= 599 ? status : 502, headers }));
    });
    const timer = setTimeout(() => req.destroy(new Error('Request timed out')), TIMEOUT_MS);
    req.on('close', () => clearTimeout(timer));
    req.on('error', reject);
    req.end();
  });
}

/** fetch() for untrusted URLs: SSRF-checked, pinned to the checked address, manual redirects (max 3), 8s timeout. */
export async function safeFetch(raw: string, init: { method?: string; headers?: HeadersInit } = {}, maxRedirects = 3): Promise<Response> {
  let current = raw;
  for (let hop = 0; ; hop++) {
    const { url, address } = await resolvePublic(current);
    const res = await pinnedRequest(url, address, init);
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
