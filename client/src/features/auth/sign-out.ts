import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ME_KEY, PUBLIC_PATHS, queryPath, useTRPC } from "../../lib/trpc";
import { discardUserDrafts } from "../journal/drafts";
import { clearPendingAction } from "./pending-action";
import { tokenStorage } from "./token-storage";

// Sign out (SPEC §2.2): the server call may fail, local personal data is cleared regardless.
export function useSignOut() {
  const trpc = useTRPC();
  const deleteSession = useMutation(trpc.session.delete.mutationOptions());
  const leave = useLeaveSession();
  return async () => {
    await deleteSession.mutateAsync().catch(() => undefined);
    await leave();
  };
}

// Local cleanup shared by sign-out and account deletion.
export function useLeaveSession() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return async () => {
    const me = queryClient.getQueryData<{ id: string } | null>(ME_KEY); // read before the cache is cleared
    await tokenStorage.clear(); // no-op on web
    await queryClient.cancelQueries();
    queryClient.removeQueries({ predicate: (q) => !PUBLIC_PATHS.includes(queryPath(q.queryKey)) && queryPath(q.queryKey) !== "me.get" });
    await clearPendingAction();
    if (me) await discardUserDrafts(me.id);
    // Leave first, so Account does not redirect the now-guest user to Login.
    router.replace("/");
    queryClient.setQueryData(ME_KEY, null);
  };
}
