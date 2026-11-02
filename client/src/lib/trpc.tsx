import type { AppRouter } from "@still/shared/router";
import { addEventListener } from "@react-native-community/netinfo";
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from "@tanstack/react-query";
import { TRPCClientError, createTRPCClient, httpBatchLink, httpLink, splitLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import Constants from "expo-constants";
import { useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

// Procedures served as cacheable GET without headers (SPEC §11.1).
const PUBLIC_PATHS = ["exhibition.get", "guide.get"];

// Staleness per kind of query (SPEC §11.10). policy.get sets 0 in its own query options.
export const STALE_TIME = { public: 5 * 60_000, personal: 30_000, policy: 0 };

// Web is same-origin; native needs the absolute API URL.
const API_URL = Platform.OS === "web" ? "" : (process.env.EXPO_PUBLIC_API_URL ?? "");

// A network failure is a TRPCClientError without server-provided data.
function isNetworkError(error: unknown) {
  return error instanceof TRPCClientError && !error.data;
}

// Queries use this by default; idempotent mutations opt in with `retry: retryNetworkErrors`.
export function retryNetworkErrors(failureCount: number, error: unknown) {
  return failureCount < 3 && isNetworkError(error);
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: retryNetworkErrors,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
        staleTime: STALE_TIME.personal,
      },
      mutations: { retry: false, networkMode: "always" },
    },
  });
}

// Native only: React Query cannot observe connectivity or app focus by itself (SPEC §11.10).
if (Platform.OS !== "web") {
  onlineManager.setEventListener((setOnline) =>
    addEventListener((state) => setOnline(state.isConnected !== false)),
  );
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener("change", (status) => handleFocus(status === "active"));
    return () => subscription.remove();
  });
}

function makeTRPCClient() {
  const url = `${API_URL}/api/trpc`;
  return createTRPCClient<AppRouter>({
    links: [
      splitLink({
        condition: (op) => PUBLIC_PATHS.includes(op.path),
        true: httpLink({ url }),
        false: httpBatchLink({
          url,
          methodOverride: "POST",
          headers: () => ({
            "x-client": Platform.OS,
            "x-client-version": Constants.expoConfig?.version ?? "unknown",
          }),
        }),
      }),
    ],
  });
}

export function TRPCReactProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  const [trpcClient] = useState(makeTRPCClient);
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
