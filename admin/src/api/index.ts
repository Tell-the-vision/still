// Picks the data source once at startup, like the institutions app:
//   production build, or `npm run dev:server` → the still backend via tRPC (src/api/trpc.ts)
//   `npm run dev`                             → in-memory mock (src/api/mock.ts)
// VITE_API_MODE=server|mock overrides both.
import { createMockApi } from "./mock";
import { createTrpcApi } from "./trpc";
import type { PlatformApi } from "./types";

const env = import.meta.env;

export const apiMode: "server" | "mock" =
  env.VITE_API_MODE === "mock" || env.VITE_API_MODE === "server"
    ? env.VITE_API_MODE
    : env.PROD || env.MODE === "server"
      ? "server"
      : "mock";

export const api: PlatformApi = apiMode === "mock" ? createMockApi() : createTrpcApi();

export * from "./types";
export { ApiError, isUnauthorized } from "./errors";
