import { NextRequest, NextResponse } from 'next/server';
import { categoryFromSlug, categoryPath } from '@/lib/categories';
import { ADMIN_COOKIE, isAdminRequest, isValidAdminCookie } from '@/lib/server/admin';
import { isComingSoonEnabled } from '@/lib/server/site-settings';
import { SITE_HOST } from '@/lib/site';

// Pages that need a signed-in account; a signed-out visitor is sent to /login and back.
const MEMBERS_ONLY = ['/profile', '/sponsor', '/payment-success'];

// Pages still reachable while coming soon mode is on. /login lets admins who sign in by email get through.
// Pricing (/rules, /faq), contact (/about) and policies stay public: Stripe reviews them before live payments.
const COMING_SOON_OPEN = [
  '/coming-soon',
  '/admin',
  '/login',
  '/forgot-password',
  '/reset-password',
  '/tos',
  '/privacy',
  '/cookies',
  '/rules',
  '/faq',
  '/about',
];

function isMainDomain(request: NextRequest): boolean {
  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase();
  return host === SITE_HOST || host.endsWith(`.${SITE_HOST}`);
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Allow static files from /public and metadata routes (robots.txt, sitemap.xml, llms.txt, icons, OG images)
  if (/\.(png|jpe?g|gif|svg|webp|ico|txt|xml|webmanifest)$/i.test(pathname) || /(^|\/)(opengraph-image|twitter-image|icon|apple-icon)(-\w+)?$/.test(pathname)) {
    return NextResponse.next();
  }

  // Old category links used ?category=AIMedia; the canonical page is /categories/ai.
  if (pathname === '/categories' && searchParams.get('category')) {
    const raw = searchParams.get('category')!;
    const category = categoryFromSlug(raw);
    const url = request.nextUrl.clone();
    url.pathname = category ? categoryPath(category) : '/categories';
    url.search = '';
    return NextResponse.redirect(url, 308);
  }

  // The admin key is never accepted in a URL (it would land in browser history and request logs):
  // a link carrying one is stripped of it. Admins sign in on /admin, which posts the key.
  if (searchParams.has('adminKey')) {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete('adminKey');
    return NextResponse.redirect(clean);
  }

  // Coming soon mode (switched from the admin dashboard): every visitor except admins sees /coming-soon.
  // It only applies on the live domain (SITE_HOST); the vercel.app domain always shows the full site.
  if (isMainDomain(request) && await isComingSoonEnabled()) {
    if (COMING_SOON_OPEN.some(route => pathname === route || pathname.startsWith(`${route}/`))) {
      return NextResponse.next();
    }
    if (pathname.startsWith('/api/')) {
      return NextResponse.next(); // API routes handle their own auth
    }
    if (await isAdminRequest(request)) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL('/coming-soon', request.url));
  }

  // The site is open: nothing to wait for on /coming-soon.
  if (pathname === '/coming-soon') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Only members-only pages need a sign-in. Everything else renders, so an unknown address
  // gets the 404 page instead of a login prompt.
  if (!MEMBERS_ONLY.some(route => pathname === route || pathname.startsWith(`${route}/`))) {
    return NextResponse.next();
  }

  if (isValidAdminCookie(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.next();
  }

  // Signed in (the page and its APIs check the session itself).
  if (request.cookies.get('auth_token')?.value) {
    return NextResponse.next();
  }

  // Signed-out visitors sign in for members-only pages, then come back with the same query
  // (e.g. /sponsor?listing=… keeps the product they chose).
  const login = new URL('/login', request.url);
  login.searchParams.set('next', pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes handle their own auth; the proxy only ever let them through)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - static files by extension (images, robots.txt, sitemap.xml, llms.txt, manifest)
     * Every match runs this function, so skipping these saves an invocation per request.
     */
    '/((?!api/|_next/static|_next/image|favicon.ico|public|.*\\.(?:png|jpe?g|gif|svg|webp|ico|txt|xml|webmanifest)$).*)',
  ],
};
