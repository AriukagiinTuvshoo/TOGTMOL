import type { NextConfig } from "next";

// Report-only for now: the policy records violations so it can be tightened
// against real traffic before anything is blocked.
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
let supabaseOrigins = "https://*.supabase.co wss://*.supabase.co";
if (supabase)
  try {
    const origin = new URL(supabase).origin;
    supabaseOrigins = `${origin} ${origin.replace(/^https/, "wss")}`;
  } catch {
    // Fall back to the wildcard when the configured URL is malformed.
  }
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: data: https:",
  `connect-src 'self' ${supabaseOrigins}`,
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "report-uri /api/csp-report",
  "report-to csp",
].join("; ");

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), payment=(), usb=(), microphone=(self)",
          },
          {
            key: "Content-Security-Policy-Report-Only",
            value: csp,
          },
          { key: "Reporting-Endpoints", value: 'csp="/api/csp-report"' },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};
export default config;
