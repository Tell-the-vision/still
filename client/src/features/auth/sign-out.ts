import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ME_KEY, PUBLIC_PATHS, queryPath, useTRPC } from "../../lib/trpc";

// Sign out (SPEC §2.2): the server call may fail, local personal data is cleared regardless.
export function useSignOut() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const deleteSession = useMutation(trpc.session.delete.mutationOptions());
  return async () => {
    await deleteSession.mutateAsync().catch(() => undefined);
    await queryClient.cancelQueries();
    queryClient.removeQueries({ predicate: (q) => !PUBLIC_PATHS.includes(queryPath(q.queryKey)) && queryPath(q.queryKey) !== "me.get" });
    // Hook point (J3): delete this user's local drafts and pending actions here.
    // Leave first, so Account does not redirect the now-guest user to Login.
    router.replace("/");
    queryClient.setQueryData(ME_KEY, null);
  };
}
