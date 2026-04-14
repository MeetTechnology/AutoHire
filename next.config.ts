import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "192.168.3.43",
    "http://192.168.3.43:3001",
  ],
  typedRoutes: true,
};

export default nextConfig;
