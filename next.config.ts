import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@still/shared"],
  experimental: {
    testProxy: process.env.E2E === "1",
  },
};

export default nextConfig;
