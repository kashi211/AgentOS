import type { NextConfig } from "next";

/**
 * All HTTP API calls are proxied through Vercel at /backend/* → Railway.
 * This eliminates CORS entirely: the browser only ever talks same-origin
 * (Vercel), and Vercel forwards the request server-side. WebSocket URLs
 * (NEXT_PUBLIC_WS_URL) remain direct — browsers don't enforce CORS on WS.
 */
const nextConfig: NextConfig = {
  async rewrites() {
    // Prefer a private BACKEND_URL if set (keeps Railway URL out of the
    // client bundle). Falls back to NEXT_PUBLIC_API_URL which is already
    // set in Vercel for the existing deployment.
    const backend =
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:8000";

    return [
      {
        source: "/backend/:path*",
        destination: `${backend}/:path*`,
      },
    ];
  },
};

export default nextConfig;
