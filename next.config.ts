import type { NextConfig } from "next";

const securityHeaders = [
  // Nobody may frame the site (stops clickjacking of voting, login and payment pages).
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
