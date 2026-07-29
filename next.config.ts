import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.19", "https://v0.app/", "https://vm-cors-error-resolution.vusercontent.net"],
  compress: true,
  experimental: {
    viewTransition: true,
    optimizePackageImports: ["lucide-react", "recharts", "radix-ui"],
  },
};

export default nextConfig;
