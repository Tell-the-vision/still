import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../../lib/trpc";

// Shared with useRequireLogin. A 401 is the normal guest answer and is never retried; any other failure is retried, and the last data is kept.
export const queryOptions = { retry: (count: number, error: { data?: { code?: string } | null }) => !isUnauthorized(error) && count < 3 };
export const isUnauthorized = (error: { data?: { code?: string } | null } | null) => error?.data?.code === "UNAUTHORIZED";

// The signed-in user, or null for a guest.
export function useMe() {
  const trpc = useTRPC();
  const query = useQuery(trpc.me.get.queryOptions(undefined, queryOptions));
  return query.data ?? null;
}

// "guest" or "signed_in" once the answer is known, null while loading or when a failure leaves it unknown.
export function useUserState() {
  const trpc = useTRPC();
  const query = useQuery(trpc.me.get.queryOptions(undefined, queryOptions));
  if (query.data) return "signed_in";
  return isUnauthorized(query.error) ? "guest" : null;
}
