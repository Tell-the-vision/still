import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @libsql/client ships a native binding; keep it out of the webpack bundle.
  serverExternalPackages: ["@libsql/client"],
  images: {
    // Cover images come from /public for the MVP. Add remote hosts here when
    // exhibition content moves to a CDN.
    remotePatterns: [],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // The SQLite file (and its -journal / -wal siblings) lives inside the
      // project. Without this, every DB write (e.g. a login) makes the dev
      // server recompile, and requests racing that recompile get HTML error
      // pages ("Unexpected end of JSON input", clientReferenceManifest…).
      // Next's default `ignored` is a RegExp (git / .next / node_modules);
      // webpack accepts either a RegExp or an array of globs, not a mix.
      const prev = config.watchOptions?.ignored;
      const prevGlobs = Array.isArray(prev) ? prev.filter((x: unknown): x is string => typeof x === "string") : [];
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          ...prevGlobs,
          "**/.git/**",
          "**/.next/**",
          "**/node_modules/**",
          "**/data/**",
          "**/*.db",
          "**/*.db-journal",
          "**/*.db-wal",
          "**/*.db-shm",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
