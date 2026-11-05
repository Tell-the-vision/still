import type { NextConfig } from "next";

// Expo web (single-page export in public/) is served same-origin: Next owns
// /api/* and exported files; every other path falls back to the SPA shell.
// In dev:hot the fallback proxies to Metro instead.
//
// The museum staff app (institutions/, built into public/institutions) is a separate SPA
// under /institutions, and the STILL platform admin app (admin/, built into public/admin)
// is another under /admin. Their paths never fall back to the visitor shell, and visitor
// paths never load their bundles.
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
        { source: "/institutions", destination: "/institutions/index.html" },
        { source: "/institutions/:path*", destination: "/institutions/index.html" },
        { source: "/admin", destination: "/admin/index.html" },
        { source: "/admin/:path*", destination: "/admin/index.html" },
        { source: "/:path((?!api/|api$|institutions/|institutions$|admin/|admin$).*)", destination: spaDestination },
      ],
    };
  },
  async headers() {
    // Staff-only: keep /institutions and /admin out of search results.
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      { source: "/institutions", headers: noindex },
      { source: "/institutions/:path*", headers: noindex },
      { source: "/admin", headers: noindex },
      { source: "/admin/:path*", headers: noindex },
    ];
  },
};

export default nextConfig;
