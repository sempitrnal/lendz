import type { NextConfig } from "next";

/**
 * Identifies this deploy. The offline sync compares it with the version it
 * last cached pages for, and re-downloads every page when it changes —
 * otherwise cached pages keep the old UI until each one is visited online.
 */
const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA ?? `local-${Date.now().toString(36)}`;

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  // Any device on the home LAN, so a DHCP address change doesn't break
  // phone testing (dev-only; ignored in production builds).
  allowedDevOrigins: ["192.168.1.*"],
  compress: true,
  experimental: {
    viewTransition: true,
    optimizePackageImports: ["lucide-react", "recharts", "radix-ui"],
  },
};

export default nextConfig;
