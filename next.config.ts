import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @libsql/client ships a native binding; keep it out of the webpack bundle.
  serverExternalPackages: ["@libsql/client"],
  images: {
    // Cover images come from /public for the MVP. Add remote hosts here when
    // exhibition content moves to a CDN.
    remotePatterns: [],
  },
};

export default nextConfig;
