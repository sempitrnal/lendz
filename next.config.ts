import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.19"],
  compress: true,
  cacheComponents: true,
  experimental: {
    viewTransition: true,
  },
};

export default nextConfig;