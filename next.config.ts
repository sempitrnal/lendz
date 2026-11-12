import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Any device on the home LAN, so a DHCP address change doesn't break
  // phone testing (dev-only; ignored in production builds).
  allowedDevOrigins: ["192.168.1.*"],
  compress: true,
  experimental: {
    viewTransition: true,
    // Pages already visited (a dashboard month, say) reopen instantly from the
    // browser for two minutes. Any change to the data fires `router.refresh()`
    // from the realtime provider, which empties this cache at once.
    staleTimes: { dynamic: 120, static: 180 },
    optimizePackageImports: ["lucide-react", "recharts", "radix-ui"],
  },
};

export default nextConfig;
