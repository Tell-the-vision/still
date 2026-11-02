import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../../lib/trpc";

// The signed-in user, or null for a guest. A 401 is the normal guest answer, so it is never retried.
export function useMe() {
  const trpc = useTRPC();
  const query = useQuery(trpc.me.get.queryOptions(undefined, { retry: false }));
  return query.data ?? null;
}
