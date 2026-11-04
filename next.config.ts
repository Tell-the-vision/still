import type { NextConfig } from "next";

// Expo web (single-page export in public/) is served same-origin: Next owns
// /api/* and exported files; every other path falls back to the SPA shell.
// In dev:hot the fallback proxies to Metro instead.
//
// The museum staff app (console/, built into public/console) is a separate SPA
// under /console. Its paths never fall back to the visitor shell, and visitor paths
// never load its bundle.
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
      fallback: [
        { source: "/console", destination: "/console/index.html" },
        { source: "/console/:path*", destination: "/console/index.html" },
        { source: "/:path((?!api/|api$|console/|console$).*)", destination: spaDestination },
      ],
    };
  },
  async headers() {
    // Staff-only: keep /console out of search results.
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      { source: "/console", headers: noindex },
      { source: "/console/:path*", headers: noindex },
    ];
  },
};

export default nextConfig;
