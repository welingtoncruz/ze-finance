import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    let apiOrigin = "http://localhost:8000 https://vitals.vercel-insights.com https://va.vercel-insights.com";
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
      if (apiBase.startsWith("http")) {
        apiOrigin = `${new URL(apiBase).origin} https://vitals.vercel-insights.com https://va.vercel-insights.com`;
      }
    } catch {
      // Fallback to default if URL parsing fails
    }

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https:",
              "font-src 'self' https://fonts.gstatic.com",
              `connect-src 'self' ${apiOrigin}`,
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
