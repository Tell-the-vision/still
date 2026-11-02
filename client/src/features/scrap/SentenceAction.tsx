import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ExpandedBlock } from "@still/shared/document";
import { retryNetworkErrors, useTRPC } from "../../lib/trpc";
import { Button } from "../../ui/Button";
import { Notice } from "../../ui/Notice";
import { Text } from "../../ui/Text";
import { TextLink } from "../../ui/TextLink";
import { useMe } from "../auth/use-me";
import { scrapStrings } from "./strings";
import { useSavedSentences } from "./useSavedSentences";

type Props = { code: string; sentence: Extract<ExpandedBlock, { type: "sentence" }> };

// Save control under a guide sentence (SPEC §4.1): guests log in, saved sentences show a plain label.
export function SentenceAction({ code, sentence }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const me = useMe();
  const saved = useSavedSentences(code);
  const listKey = trpc.scrap.list.queryKey({ code });
  const { mutate, isPending, isError } = useMutation(
    trpc.scrap.upsert.mutationOptions({
      scope: { id: `scrap:${code}:${sentence.sentenceId}` },
      retry: retryNetworkErrors,
      onMutate: async () => {
        await queryClient.cancelQueries({ queryKey: listKey });
        const snapshot = queryClient.getQueryData(listKey);
        const entry = { sentenceId: sentence.sentenceId, content: sentence.text, createdAt: new Date().toISOString() };
        queryClient.setQueryData(listKey, [...(snapshot ?? []), entry]);
        return { snapshot };
      },
      onError: (_error, _input, context) => queryClient.setQueryData(listKey, context?.snapshot),
      onSettled: () =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: trpc.scrap.pathKey() }),
          queryClient.invalidateQueries({ queryKey: trpc.archive.pathKey() }),
        ]),
    }),
  );
  const save = () => mutate({ code, sentenceId: sentence.sentenceId });
  if (!me) return <TextLink href={{ pathname: "/login", params: { returnTo: `/e/${code}` } }} label={scrapStrings.loginRequired} variant="secondary" />;
  if (saved.has(sentence.sentenceId)) return <Text variant="secondary">{scrapStrings.saved}</Text>;
  if (isError) return (
    <>
      <Notice message={scrapStrings.saveFailed} error />
      <Button label={scrapStrings.retry} variant="secondary" onPress={save} />
    </>
  );
  return <Button label={scrapStrings.save} variant="secondary" disabled={isPending} onPress={save} />;
}
