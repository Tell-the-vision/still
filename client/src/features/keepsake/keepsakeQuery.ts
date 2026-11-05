import type { useTRPC } from "../../lib/trpc";

// One page's card (each artwork has its own). SPEC §11.10: refetch a minute before the signed PNG URL expires.
export function keepsakeQueryOptions(trpc: ReturnType<typeof useTRPC>, code: string, page: string, enabled = true) {
  return {
    ...trpc.keepsake.get.queryOptions({ code, page }, { enabled }),
    refetchInterval: ({ state }: { state: { data: { png: { expiresAt: string } } | null | undefined } }) =>
      state.data ? Math.max(Date.parse(state.data.png.expiresAt) - 60_000 - Date.now(), 1000) : false,
  };
}
