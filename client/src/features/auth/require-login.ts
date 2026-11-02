import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { useTRPC } from "../../lib/trpc";

// For screens that need a signed-in user (SPEC §0.3): guests go to Login and come back to `returnTo`.
// Returns the user once known, or null while loading or redirecting.
export function useRequireLogin(returnTo: string) {
  const trpc = useTRPC();
  const router = useRouter();
  const query = useQuery(trpc.me.get.queryOptions(undefined, { retry: false }));
  // A user who signs out here is heading Home, not to Login.
  const wasSignedIn = useRef(false);
  if (query.data) wasSignedIn.current = true;
  const isGuest = query.isFetched && !query.data && !wasSignedIn.current;
  useEffect(() => {
    if (isGuest) router.replace({ pathname: "/login", params: { returnTo } });
  }, [isGuest, router, returnTo]);
  return query.data ?? null;
}
