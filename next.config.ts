import type { NextConfig } from "next"

/**
 * Baseline security headers for every response. A Content-Security-Policy
 * (needs nonces for Next's inline scripts) and HSTS (needs the production
 * HTTPS domain) are added at deployment, after M12.
 */
const securityHeaders = [
  // Nobody may embed ReelPilot in a frame (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Browsers must not guess content types.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send only the origin to other sites, never full URLs.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Features the app doesn't use yet. Screen recording (M2) will need
  // display-capture=(self) and microphone=(self) added here.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), display-capture=()",
  },
]

const nextConfig: NextConfig = {
  devIndicators: false,
  // Don't advertise the framework in an X-Powered-By header.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
