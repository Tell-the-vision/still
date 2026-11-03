import { track } from "../../lib/analytics";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ExpandedBlock } from "@still/shared/document";
import { useRouter } from "expo-router";
import { useEffect, useRef, type RefObject } from "react";
import { View, type HostInstance } from "react-native";
import { retryNetworkErrors, useTRPC } from "../../lib/trpc";
import { Notice } from "../../ui/Notice";
import { TextAction } from "../../ui/TextAction";
import { Text } from "../../ui/Text";
import { savePendingAction } from "../auth/pending-action";
import { useMe } from "../auth/use-me";
import { scrapStrings } from "./strings";
import { useSavedSentences } from "./useSavedSentences";

// Root views of the mounted sentences, so a restored one can be scrolled back into view.
export const sentenceViews = new Map<string, RefObject<HostInstance | null>>();

type Props = { code: string; sentence: Extract<ExpandedBlock, { type: "sentence" }> };

// Save control under a guide sentence (SPEC §4.1): guests log in, saved sentences show a plain label.
export function SentenceAction({ code, sentence }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
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
      onSuccess: () => track("scrap_save", { exhibition_code: code, sentence_id: sentence.sentenceId }),
      onError: (_error, _input, context) => queryClient.setQueryData(listKey, context?.snapshot),
      onSettled: () =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: trpc.scrap.pathKey() }),
          queryClient.invalidateQueries({ queryKey: trpc.archive.pathKey() }),
        ]),
    }),
  );
  const viewRef = useRef<HostInstance>(null);
  useEffect(() => {
    sentenceViews.set(sentence.sentenceId, viewRef);
    return () => void sentenceViews.delete(sentence.sentenceId);
  }, [sentence.sentenceId]);
  const save = () => mutate({ code, sentenceId: sentence.sentenceId });
  const loginThenSave = async () => {
    await savePendingAction({ kind: "SCRAP_SAVE", exhibitionCode: code, sentenceId: sentence.sentenceId });
    router.push({ pathname: "/login", params: { returnTo: `/e/${code}` } });
  };
  const renderControl = () => {
    if (!me) return <TextAction variant="label" label={scrapStrings.loginRequired} onPress={() => void loginThenSave()} />;
    if (saved.has(sentence.sentenceId)) return <Text variant="secondary">{scrapStrings.saved}</Text>;
    if (isError) return <Notice message={scrapStrings.saveFailed} error action={{ label: scrapStrings.retry, onPress: save }} />;
    return <TextAction variant="label" label={scrapStrings.save} disabled={isPending} onPress={save} />;
  };
  return <View ref={viewRef}>{renderControl()}</View>;
}
