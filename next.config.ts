import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV !== "production";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://maps.googleapis.com${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://i.pravatar.cc https://*.googleapis.com https://*.gstatic.com https://maps.gstatic.com",
  "font-src 'self' data:",
  // Sentry ingest is required for browser error reporting: without it the CSP
  // silently drops every client-side event. Narrow these wildcards to the exact
  // host from NEXT_PUBLIC_SENTRY_DSN once it is known.
  "connect-src 'self' https://api.razorpay.com https://maps.googleapis.com https://places.googleapis.com https://*.googleapis.com https://*.gstatic.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io",
  "frame-src 'self' https://checkout.razorpay.com https://api.razorpay.com https://www.google.com https://maps.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "i.pravatar.cc" }] },
  async redirects() {
    return [
      {
        source: "/ladmin",
        destination: "/admin",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      // Canonical, mobile-ready API namespace. Existing route handlers remain the single
      // implementation while web clients are migrated from legacy /api/* URLs.
      { source: "/api/v1/:path*", destination: "/api/:path*" },
    ];
  },
  async headers() {
    return [
      {
        // Documents and API responses only. Immutable build assets under
        // _next/static gain nothing from a CSP or Permissions-Policy.
        source: "/((?!_next/static|_next/image).*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
