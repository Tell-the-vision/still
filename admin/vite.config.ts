import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// The platform admin app (STILL staff only) is a separate bundle served by Next at /admin (see next.config.ts).
// It is built after the Expo web export, into public/admin, so visitors and museum staff never download its code.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    base: "/admin/",
    plugins: [react()],
    build: {
      outDir: "../public/admin",
      emptyOutDir: true,
    },
    server: {
      port: 5190,
      // `npm run dev:server` talks to a running still server (npm run dev, port 3000) on the same origin.
      proxy: { "/api": { target: env.VITE_API_PROXY || "http://localhost:3000", changeOrigin: true } },
    },
  };
});
