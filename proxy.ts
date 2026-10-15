import { NextRequest, NextResponse } from 'next/server';
import { categoryFromSlug, categoryPath } from '@/lib/categories';
import { ADMIN_COOKIE, adminCookieValue, isAdminRequest, isValidAdminCookie, isValidAdminKey } from '@/lib/server/admin';
import { isComingSoonEnabled } from '@/lib/server/site-settings';

// Indexable content pages, open to everyone (and search/AI crawlers) before launch.
// Matched exactly or as a path prefix ('/product' covers '/product/:id').
const PUBLIC_PAGES = [
  '/about',
  '/why',
  '/rules',
  '/faq',
  '/categories',
  '/platforms',
  '/product',
  '/leaderboard',
  '/sponsored',
  '/today',
  '/daily',
  '/archive',
  '/stats',
];

const PUBLIC_ROUTES = [
  '/coming-soon',
  '/login',
  '/signup',
  '/admin',
  '/support', // shareable vote links: guests vote with name + email
  '/tos',
  '/privacy',
  '/cookies',
  '/api/waitlist',
  '/api/waitlist/count',
];

// Pages still reachable while coming soon mode is on. /login lets admins who sign in by email get through.
// Pricing (/rules, /faq), contact (/about) and policies stay public: Stripe reviews them before live payments.
const COMING_SOON_OPEN = [
  '/coming-soon',
  '/admin',
  '/login',
  '/tos',
  '/privacy',
  '/cookies',
  '/rules',
  '/faq',
  '/about',
];

function isMainDomain(request: NextRequest): boolean {
  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase();
  return host === 'rankbid.click' || host.endsWith('.rankbid.click');
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

  // ?adminKey=<ADMIN_KEY> signs this browser in as admin, then the key is dropped from the URL.
  const queryKey = searchParams.get('adminKey');
  if (queryKey && isValidAdminKey(queryKey)) {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete('adminKey');
    const response = NextResponse.redirect(clean);
    response.cookies.set(ADMIN_COOKIE, adminCookieValue()!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });
    return response;
  }

  // Coming soon mode (switched from the admin dashboard): every visitor except admins sees /coming-soon.
  // It only applies on rankbid.click; the vercel.app domain always shows the full site.
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

  if (pathname === '/' || PUBLIC_PAGES.some(route => pathname === route || pathname.startsWith(`${route}/`))) {
    return NextResponse.next();
  }

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow API routes (they handle their own auth)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (isValidAdminCookie(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.next();
  }

  // Check for auth token (user logged in)
  const authToken = request.cookies.get('auth_token')?.value;

  // For authenticated users (logged in), allow access
  if (authToken) {
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
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
