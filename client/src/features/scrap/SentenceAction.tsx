import { track } from "../../lib/analytics";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ExpandedBlock } from "@still/shared/document";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Platform, Pressable, StyleSheet, View, type HostInstance } from "react-native";
import { retryNetworkErrors, useTRPC } from "../../lib/trpc";
import { Notice } from "../../ui/Notice";
import { colors, focusRing, spacing } from "../../ui/theme";
import { savePendingAction } from "../auth/pending-action";
import { useMe } from "../auth/use-me";
import { scrapStrings } from "./strings";
import { useSavedSentences } from "./useSavedSentences";

// Root views of the mounted sentences, so a restored one can be scrolled back into view.
export const sentenceViews = new Map<string, RefObject<HostInstance | null>>();

type Props = { code: string; sentence: Extract<ExpandedBlock, { type: "sentence" }>; quote: ReactNode };

// The quote with a mark beside it (SPEC §4.1): "+" keeps the line, a check shows it is kept and removes it again. Guests sign in first.
export function SentenceAction({ code, sentence, quote }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const me = useMe();
  const saved = useSavedSentences(code);
  const listKey = trpc.scrap.list.queryKey({ code });
  const { mutate, isPending: saving, isError: saveError } = useMutation(
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
  const remove = useMutation(
    trpc.scrap.delete.mutationOptions({
      scope: { id: `scrap:${code}:${sentence.sentenceId}` },
      retry: retryNetworkErrors,
      onMutate: async () => {
        await queryClient.cancelQueries({ queryKey: listKey });
        const snapshot = queryClient.getQueryData(listKey);
        queryClient.setQueryData(listKey, snapshot?.filter((scrap) => scrap.sentenceId !== sentence.sentenceId));
        return { snapshot };
      },
      onSuccess: () => track("scrap_remove", { exhibition_code: code, sentence_id: sentence.sentenceId }),
      onError: (_error, _input, context) => queryClient.setQueryData(listKey, context?.snapshot),
      onSettled: () =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: trpc.scrap.pathKey() }),
          queryClient.invalidateQueries({ queryKey: trpc.archive.pathKey() }),
        ]),
    }),
  );
  const kept = saved.has(sentence.sentenceId);
  const [focused, setFocused] = useState(false);
  const viewRef = useRef<HostInstance>(null);
  useEffect(() => {
    sentenceViews.set(sentence.sentenceId, viewRef);
    return () => void sentenceViews.delete(sentence.sentenceId);
  }, [sentence.sentenceId]);
  // react-native-web drops `title`, so the tooltip is set on the DOM node.
  const markRef = useRef<HostInstance>(null);
  const tooltip = kept ? scrapStrings.keptTitle : scrapStrings.keep;
  useEffect(() => {
    if (Platform.OS === "web") (markRef.current as unknown as HTMLElement | null)?.setAttribute("title", tooltip);
  }, [tooltip]);
  const save = () => mutate({ code, sentenceId: sentence.sentenceId });
  const loginThenSave = async () => {
    await savePendingAction({ kind: "SCRAP_SAVE", exhibitionCode: code, sentenceId: sentence.sentenceId });
    router.push({ pathname: "/login", params: { returnTo: `/e/${code}` } });
  };
  const unkeep = () => remove.mutate({ code, sentenceId: sentence.sentenceId });
  const press = !me ? () => void loginThenSave() : kept ? unkeep : save;
  const pending = saving || remove.isPending;
  return (
    <View ref={viewRef} style={{ gap: spacing.inset }}>
      <View style={styles.row}>
        <View style={styles.quote}>{quote}</View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={kept ? scrapStrings.remove : scrapStrings.keep}
          ref={markRef}
          accessibilityHint={!me ? scrapStrings.signInHint : undefined}
          accessibilityState={{ selected: kept, disabled: pending }}
          disabled={pending}
          onPress={press}
          hitSlop={{ top: 13, bottom: 12, left: 10, right: 10 }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.mark, pending && styles.pending, focused && focusRing]}
        >
          {kept ? <Check /> : <Plus />}
        </Pressable>
      </View>
      {saveError && !kept && <Notice message={scrapStrings.saveFailed} error action={{ label: scrapStrings.retry, onPress: save }} />}
      {remove.isError && kept && <Notice message={scrapStrings.removeFailed} error action={{ label: scrapStrings.retry, onPress: unkeep }} />}
    </View>
  );
}

// Two 1px bars in a 12x12 box; black only (SPEC §0.3).
function Plus() {
  return (
    <View aria-hidden style={styles.box}>
      <View style={[styles.bar, { width: MARK, height: 1 }]} />
      <View style={[styles.bar, { width: 1, height: MARK }]} />
    </View>
  );
}

// A checkmark from two 1px bars: a short stroke down to the right, a long one up to the right.
function Check() {
  return (
    <View aria-hidden style={styles.box}>
      <View style={[styles.bar, { width: 1, height: 5, left: 2, top: 5.5, transform: [{ rotate: "-45deg" }] }]} />
      <View style={[styles.bar, { width: 1, height: 10, left: 7.5, top: 1, transform: [{ rotate: "40deg" }] }]} />
    </View>
  );
}

const MARK = 12;
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.tight },
  quote: { flex: 1 },
  // 24 wide and one quote line (18.6) tall, so the mark sits on the first line.
  mark: { width: 24, height: 19, alignItems: "center", justifyContent: "center" },
  pending: { opacity: 0.4 },
  box: { width: MARK, height: MARK, alignItems: "center", justifyContent: "center" },
  bar: { position: "absolute", backgroundColor: colors.black },
});
