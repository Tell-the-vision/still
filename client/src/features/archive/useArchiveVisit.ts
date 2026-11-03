import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { retryNetworkErrors, useTRPC } from "../../lib/trpc";
import { useMe } from "../auth/use-me";

// Opening a guide while signed in records the visit, once per mount per code (SPEC §8.1).
export function useArchiveVisit(code: string, ready: boolean) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const me = useMe();
  const visited = useRef<string | null>(null);
  const { mutate } = useMutation(
    trpc.archive.upsert.mutationOptions({
      retry: retryNetworkErrors,
      onSuccess: async (result) => {
        queryClient.setQueryData(trpc.archive.get.queryKey({ code }), result.archive);
        await queryClient.invalidateQueries({ queryKey: trpc.archive.list.pathKey() });
      },
    }),
  );
  useEffect(() => {
    if (!me || !ready || visited.current === code) return;
    visited.current = code;
    mutate({ code });
  }, [me, ready, code, mutate]);
}
