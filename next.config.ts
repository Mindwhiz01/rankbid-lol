import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Where the browser may load things from. Scripts: the site itself, Google sign-in, Cloudflare Turnstile
// and Vercel's preview toolbar. 'unsafe-inline' stays because Next.js inlines its boot scripts; it still
// blocks scripts from any other host. Images may come from any https site (product previews, favicons).
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"} https://accounts.google.com https://challenges.cloudflare.com https://vercel.live`,
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://vercel.live",
  "connect-src 'self' https: wss://ws-us3.pusher.com",
  "frame-src https://accounts.google.com https://challenges.cloudflare.com https://vercel.live",
  "form-action 'self'",
  // Nobody may frame the site (stops clickjacking of voting, login and payment pages).
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Other sites' windows can't reach this one; the Google sign-in popup still can.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["192.168.40.101", "192.168.20.39"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The site also loads on *.vercel.app (no coming soon page there); keep those copies out of search
      // so only rankbid.click gets indexed.
      {
        source: "/:path*",
        has: [{ type: "host", value: ".*\\.vercel\\.app" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  async redirects() {
    return [
      // Legacy paid-bidding pages: listings now live at /product/:id and
      // submissions go through the free form on the homepage.
      {
        source: "/listing/:id",
        destination: "/product/:id",
        permanent: true,
      },
      {
        source: "/dashboard",
        destination: "/profile",
        permanent: false,
      },
      {
        source: "/claim",
        destination: "/#submit",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
