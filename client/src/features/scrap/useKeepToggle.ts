import { track } from "../../lib/analytics";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { retryNetworkErrors, useTRPC } from "../../lib/trpc";

// Keep and unkeep one line, both optimistic on the exhibition's scrap list and serialized in one mutation scope.
export function useKeepToggle(code: string, sentenceId: string, content: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const listKey = trpc.scrap.list.queryKey({ code });
  const shared = {
    scope: { id: `scrap:${code}:${sentenceId}` },
    retry: retryNetworkErrors,
    onError: (_error: unknown, _input: unknown, context: { snapshot?: { sentenceId: string; content: string; createdAt: string }[] } | undefined) =>
      queryClient.setQueryData(listKey, context?.snapshot),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: trpc.scrap.pathKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.archive.pathKey() }),
      ]),
  };
  const keep = useMutation(
    trpc.scrap.upsert.mutationOptions({
      ...shared,
      onMutate: async () => {
        await queryClient.cancelQueries({ queryKey: listKey });
        const snapshot = queryClient.getQueryData(listKey);
        queryClient.setQueryData(listKey, [...(snapshot ?? []), { sentenceId, content, createdAt: new Date().toISOString() }]);
        return { snapshot };
      },
      onSuccess: () => track("scrap_save", { exhibition_code: code, sentence_id: sentenceId }),
    }),
  );
  const unkeep = useMutation(
    trpc.scrap.delete.mutationOptions({
      ...shared,
      onMutate: async () => {
        await queryClient.cancelQueries({ queryKey: listKey });
        const snapshot = queryClient.getQueryData(listKey);
        queryClient.setQueryData(listKey, snapshot?.filter((scrap) => scrap.sentenceId !== sentenceId));
        return { snapshot };
      },
      onSuccess: () => track("scrap_remove", { exhibition_code: code, sentence_id: sentenceId }),
    }),
  );
  return {
    keep: () => keep.mutate({ code, sentenceId }),
    unkeep: () => unkeep.mutate({ code, sentenceId }),
    pending: keep.isPending || unkeep.isPending,
    keepFailed: keep.isError,
    unkeepFailed: unkeep.isError,
  };
}
