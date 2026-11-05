import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// The console app is a separate bundle served by Next at /console (see next.config.ts).
// It is built after the Expo web export, into public/console, so visitors never download its code.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const target = env.VITE_API_PROXY || "http://localhost:3000";
  return {
    base: "/console/",
    plugins: [react()],
    build: {
      outDir: "../public/console",
      emptyOutDir: true,
    },
    server: {
      port: 5180,
      // `npm run dev:server` talks to a running still server (npm run dev, port 3000) on the same origin.
      // Cookie calls must carry Origin === STILL_ORIGIN (SPEC §2.3). changeOrigin only rewrites Host, so the
      // dev proxy also rewrites Origin to the server's own origin (dev only; set STILL_ORIGIN to that origin).
      proxy: {
        "/api": {
          target,
          changeOrigin: true,
          configure: (proxy) => proxy.on("proxyReq", (req) => { if (req.getHeader("origin")) req.setHeader("origin", new URL(target).origin); }),
        },
      },
    },
  };
});
