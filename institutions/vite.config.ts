import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// The institutions app is a separate bundle served by Next at /institutions (see next.config.ts).
// It is built after the Expo web export, into public/institutions, so visitors never download its code.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    base: "/institutions/",
    plugins: [react()],
    build: {
      outDir: "../public/institutions",
      emptyOutDir: true,
    },
    server: {
      port: 5180,
      // `npm run dev:server` talks to a running still server (npm run dev, port 3000) on the same origin.
      proxy: { "/api": { target: env.VITE_API_PROXY || "http://localhost:3000", changeOrigin: true } },
    },
  };
});
