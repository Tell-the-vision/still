import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tidewave from 'tidewave/vite-plugin';

// The console app is a separate bundle served by Next at /console (see next.config.ts).
// It is built after the Expo web export, into public/console, so visitors never download its code.
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, ".", "");
  const target = env.VITE_API_PROXY || "http://localhost:3000";
  // The visitor app's origin: the same one the server encodes in printed QR codes (STILL_ORIGIN, SPEC §1.2).
  // The Docker build passes it as EXPO_PUBLIC_STILL_ORIGIN for the visitor app; in dev the visitor pages are
  // served by the same server the API proxy points at.
  // In dev this server also serves the visitor app (proxied below), so guide links stay on its own origin.
  const visitorOrigin = process.env.EXPO_PUBLIC_STILL_ORIGIN || env.EXPO_PUBLIC_STILL_ORIGIN || env.STILL_ORIGIN
    || (command === "serve" ? "http://localhost:5180" : new URL(target).origin);
  // Proxied requests carry the server's own Origin (cookie calls must match STILL_ORIGIN, SPEC §2.3; dev only).
  const toServer = {
    target,
    changeOrigin: true,
    configure: (proxy: { on: (event: "proxyReq", fn: (req: { getHeader: (name: string) => unknown; setHeader: (name: string, value: string) => void }) => void) => void }) =>
      proxy.on("proxyReq", (req) => { if (req.getHeader("origin")) req.setHeader("origin", new URL(target).origin); }),
  };
  return {
    base: "/console/",
    define: { "import.meta.env.VITE_VISITOR_ORIGIN": JSON.stringify(visitorOrigin.replace(/\/$/, "")) },
    plugins: [
      tidewave(),
      react(),
      // The app lives under /console/; a reload on /console (as the router writes it) would get Vite's base-URL notice.
      {
        name: "console-trailing-slash",
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === "/console" || req.url?.startsWith("/console?")) {
              res.writeHead(302, { Location: req.url.replace("/console", "/console/") });
              res.end();
              return;
            }
            next();
          });
        },
      },
    ],
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
        "/api": toServer,
        // Dev only: the admin app's own Vite server (admin:dev, 5190), so it opens on this origin too and Tidewave can
        // embed and edit it. Its base is /admin/, so its modules and HMR socket live under the same prefix.
        "^/admin(?:/|$)": { target: env.VITE_ADMIN_DEV_URL || "http://localhost:5190", ws: true },
        // Everything outside /console (the visitor guide at /e/…, its assets) comes from the same server, so the
        // console and the guide it publishes share one origin in dev. Vite's own paths are left alone.
        "^/(?!console(?:/|$)|@|node_modules|tidewave|__).*": toServer,
      },
    },
  };
});
