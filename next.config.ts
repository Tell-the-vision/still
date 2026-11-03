import type { NextConfig } from "next";

// Expo web (single-page export in public/) is served same-origin: Next owns
// /api/* and exported files; every other path falls back to the SPA shell.
// In dev:hot the fallback proxies to Metro instead.
const spaDestination = process.env.EXPO_WEB_DEV_URL
  ? `${process.env.EXPO_WEB_DEV_URL}/:path`
  : "/index.html";

const nextConfig: NextConfig = {
  transpilePackages: ["@still/shared"],
  experimental: {
    testProxy: process.env.E2E === "1",
  },
  async rewrites() {
    return {
      fallback: [{ source: "/:path((?!api/|api$).*)", destination: spaDestination }],
    };
  },
};

export default nextConfig;
