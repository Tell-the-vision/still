// Picks the data source once at startup.
//   production build, or `npm run dev:server` → the still backend via tRPC (src/api/trpc.ts)
//   `npm run dev`                             → in-memory mock for building screens without a backend (src/api/mock.ts)
//                                                ?seed=empty in the URL starts the mock with no data.
// VITE_API_MODE=server|mock overrides both.
import { createMockApi } from "./mock";
import { createTrpcApi } from "./trpc";
import type { InstitutionsApi } from "./types";

const env = import.meta.env;

export const apiMode: "server" | "mock" =
  env.VITE_API_MODE === "mock" || env.VITE_API_MODE === "server"
    ? env.VITE_API_MODE
    : env.PROD || env.MODE === "server"
      ? "server"
      : "mock";

function mockSeed(): "sample" | "empty" {
  const fromUrl = new URLSearchParams(window.location.search).get("seed");
  return (fromUrl ?? env.VITE_MOCK_SEED) === "empty" ? "empty" : "sample";
}

export const api: InstitutionsApi = apiMode === "mock" ? createMockApi(mockSeed()) : createTrpcApi();

export * from "./types";
export { ApiError, isUnauthorized } from "./errors";
