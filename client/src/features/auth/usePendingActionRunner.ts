import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useTRPC } from "../../lib/trpc";
import { takePendingAction } from "./pending-action";
import { useMe } from "./use-me";

// Runs the guest's saved sentence once the user is signed in and has agreed (SPEC §2.2 Sign in 8).
export function usePendingActionRunner(code: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const me = useMe();
  const consent = useQuery(trpc.consent.get.queryOptions(undefined, { enabled: !!me }));
  const upsert = useMutation(trpc.scrap.upsert.mutationOptions());
  const ran = useRef(false);
  const ready = !!me && !!consent.data;

  useEffect(() => {
    if (!ready || ran.current) return;
    ran.current = true;
    void (async () => {
      const action = await takePendingAction({ kind: "SCRAP_SAVE", exhibitionCode: code });
      if (!action || action === "expired") return; // expiry notice arrives with S3b
      await upsert.mutateAsync({ code, sentenceId: action.sentenceId }).catch(() => undefined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: trpc.scrap.pathKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.archive.pathKey() }),
      ]);
    })();
  }, [ready, code, upsert, queryClient, trpc]);
}
