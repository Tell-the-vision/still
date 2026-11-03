import type { useTRPC } from "../../lib/trpc";

// SPEC §11.10: refetch a minute before the signed PNG URL expires. Shared by Archive Detail and the Guide.
export function keepsakeQueryOptions(trpc: ReturnType<typeof useTRPC>, code: string, enabled = true) {
  return {
    ...trpc.keepsake.get.queryOptions({ code }, { enabled }),
    refetchInterval: ({ state }: { state: { data: { png: { expiresAt: string } } | null | undefined } }) =>
      state.data ? Math.max(Date.parse(state.data.png.expiresAt) - 60_000 - Date.now(), 1000) : false,
  };
}
