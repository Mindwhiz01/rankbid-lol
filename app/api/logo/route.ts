import { NextRequest, NextResponse } from 'next/server';

// GET ?domain&sz — a site's logo, fetched from Google's favicon service by the server and cached on the
// CDN, so visitors' browsers never contact Google (see lib/logo.ts). The upstream host is fixed.
const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;
const SIZES = new Set(['16', '32', '64', '128', '256']);

export async function GET(req: NextRequest) {
  const domain = (req.nextUrl.searchParams.get('domain') || '').toLowerCase();
  const sz = req.nextUrl.searchParams.get('sz') || '64';
  if (!DOMAIN_RE.test(domain) || !SIZES.has(sz)) {
    return new NextResponse(null, { status: 400 });
  }
  try {
    const upstream = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${sz}`, {
      next: { revalidate: 7 * 24 * 60 * 60 },
    });
    const type = upstream.headers.get('content-type') || '';
    // An unknown site gets Google's generic globe (sent with a 404); it's still an image, so serve it as before.
    if (!type.startsWith('image/')) {
      return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'public, s-maxage=86400' } });
    }
    return new NextResponse(await upstream.arrayBuffer(), {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
