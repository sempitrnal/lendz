import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
