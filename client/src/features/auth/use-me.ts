import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../../lib/trpc";

// The signed-in user, or null for a guest. A 401 is the normal guest answer, so it is never retried.
export function useMe() {
  const trpc = useTRPC();
  const query = useQuery(trpc.me.get.queryOptions(undefined, { retry: false }));
  return query.data ?? null;
}

// "guest" or "signed_in" once the answer is known, null while it is loading.
export function useUserState() {
  const trpc = useTRPC();
  const query = useQuery(trpc.me.get.queryOptions(undefined, { retry: false }));
  if (query.isPending) return null;
  return query.data ? "signed_in" : "guest";
}
