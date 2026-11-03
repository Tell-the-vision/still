import type { AppRouter } from "@still/shared/router";
import { addEventListener } from "@react-native-community/netinfo";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider, focusManager, onlineManager } from "@tanstack/react-query";
import { TRPCClientError, createTRPCClient, httpBatchLink, httpLink, splitLink, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import Constants from "expo-constants";
import { createContext, useContext, useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";
import { tokenStorage } from "../features/auth/token-storage";

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

// Procedures served as cacheable GET without headers (SPEC §11.1).
export const PUBLIC_PATHS = ["exhibition.get", "exhibition.list", "guide.get"];

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

const isUnauthorized = (error: unknown) => error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED";
export const ME_KEY = [["me", "get"], { type: "query" }];
export const CONSENT_KEY = [["consent", "get"], { type: "query" }];
export const queryPath = (key: readonly unknown[]) => (key[0] as string[]).join(".");
const isUpgradeRequired = (error: unknown) => error instanceof TRPCClientError && error.data?.appCode === "CLIENT_UPGRADE_REQUIRED";
const isRateLimited = (error: unknown) => error instanceof TRPCClientError && error.data?.code === "TOO_MANY_REQUESTS";
const isConsentRequired = (error: unknown) => error instanceof TRPCClientError && error.data?.appCode === "CONSENT_REQUIRED";

// SPEC §2.3: a 401 while signed in means the session ended. Drop personal data, keep drafts and pending actions.
// A guest's own me.get 401 is ignored because me.get has no data.
export function makeQueryClient(onSessionEnded: () => void, onUpgradeRequired: () => void, onRateLimited: () => void) {
  const handleError = (error: unknown) => {
    // The server says consent is missing: ConsentGate redirects when it sees consent.get is null.
    if (isConsentRequired(error)) queryClient.setQueryData(CONSENT_KEY, null);
    if (isUpgradeRequired(error)) onUpgradeRequired();
    if (isRateLimited(error)) onRateLimited();
    if (!isUnauthorized(error) || !queryClient.getQueryData(ME_KEY)) return;
    queryClient.removeQueries({ predicate: (q) => !PUBLIC_PATHS.includes(queryPath(q.queryKey)) && queryPath(q.queryKey) !== "me.get" });
    queryClient.setQueryData(ME_KEY, null);
    onSessionEnded();
  };
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: handleError }),
    mutationCache: new MutationCache({ onError: handleError }),
    defaultOptions: {
      queries: {
        retry: retryNetworkErrors,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
        staleTime: STALE_TIME.personal,
      },
      mutations: { retry: false, networkMode: "always" },
    },
  });
  return queryClient;
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

const clientHeaders = () => ({ "x-client": Platform.OS, "x-client-version": Constants.expoConfig?.version ?? "unknown" });

// One refresh at a time: concurrent 401s wait for the same request (SPEC §2.3).
let refreshing: Promise<boolean> | null = null;

// Plain fetch, so the refresh itself never passes through this link. Returns false when the server
// answers UNAUTHORIZED (tokens cleared); any other failure throws a network error and keeps the tokens.
async function refreshTokens() {
  const refreshToken = await tokenStorage.getRefreshToken();
  let json;
  try {
    const res = await fetch(`${API_URL}/api/trpc/session.refresh`, {
      method: "POST",
      headers: { "content-type": "application/json", ...clientHeaders() },
      body: JSON.stringify({ refreshToken }),
    });
    json = await res.json();
  } catch {
    throw new TRPCClientError("Network request failed");
  }
  if (json.result) {
    await tokenStorage.save(json.result.data);
    return true;
  }
  if (json.error?.data?.code === "UNAUTHORIZED") {
    await tokenStorage.clear();
    return false;
  }
  throw new TRPCClientError("Network request failed");
}

// Native only: on UNAUTHORIZED refresh the tokens and retry the call once. If the refresh is also
// UNAUTHORIZED, the original error goes on and the query cache ends the session.
const refreshLink: TRPCLink<AppRouter> = () => ({ op, next }) =>
  observable((observer) => {
    const run = (retry: boolean) =>
      next(op).subscribe({
        next: (value) => observer.next(value),
        complete: () => observer.complete(),
        error: async (error) => {
          if (!retry || !isUnauthorized(error)) return observer.error(error);
          refreshing ??= refreshTokens().finally(() => (refreshing = null));
          try {
            if (!(await refreshing)) return observer.error(error);
          } catch (networkError) {
            return observer.error(networkError as TRPCClientError<AppRouter>);
          }
          run(false);
        },
      });
    return run(true).unsubscribe;
  });

function makeTRPCClient() {
  const url = `${API_URL}/api/trpc`;
  return createTRPCClient<AppRouter>({
    links: [
      ...(Platform.OS === "web" ? [] : [refreshLink]),
      splitLink({
        condition: (op) => PUBLIC_PATHS.includes(op.path),
        true: httpLink({ url }),
        false: httpBatchLink({
          url,
          methodOverride: "POST",
          headers: async () => {
            const accessToken = await tokenStorage.getAccessToken(); // always null on web
            return {
              ...clientHeaders(),
              ...(accessToken && { authorization: `Bearer ${accessToken}` }),
            };
          },
        }),
      }),
    ],
  });
}

const SessionEndedContext = createContext(false);
export const useSessionEnded = () => useContext(SessionEndedContext);

const UpgradeRequiredContext = createContext(false);
export const useUpgradeRequired = () => useContext(UpgradeRequiredContext);

const RateLimitedContext = createContext(false);
export const useRateLimited = () => useContext(RateLimitedContext);

const RATE_LIMIT_NOTICE_MS = 10_000;

export function TRPCReactProvider({ children }: { children: ReactNode }) {
  const [sessionEnded, setSessionEnded] = useState(false);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [queryClient] = useState(() =>
    makeQueryClient(
      () => setSessionEnded(true),
      () => setUpgradeRequired(true),
      () => {
        setRateLimited(true);
        setTimeout(() => setRateLimited(false), RATE_LIMIT_NOTICE_MS);
      },
    ),
  );
  const [trpcClient] = useState(makeTRPCClient);
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <SessionEndedContext.Provider value={sessionEnded}>
          <UpgradeRequiredContext.Provider value={upgradeRequired}>
            <RateLimitedContext.Provider value={rateLimited}>{children}</RateLimitedContext.Provider>
          </UpgradeRequiredContext.Provider>
        </SessionEndedContext.Provider>
      </TRPCProvider>
    </QueryClientProvider>
  );
}
