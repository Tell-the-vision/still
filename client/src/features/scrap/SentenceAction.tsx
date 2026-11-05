import { useRouter } from "expo-router";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { StyleSheet, View, type HostInstance } from "react-native";
import { Notice } from "../../ui/Notice";
import { colors, spacing } from "../../ui/theme";
import { savePendingAction } from "../auth/pending-action";
import { useMe } from "../auth/use-me";
import { KeepMark } from "./KeepMark";
import { scrapStrings } from "./strings";
import { useKeepToggle } from "./useKeepToggle";
import { useSavedSentences } from "./useSavedSentences";

// Root views of the mounted sentences, so a restored one can be scrolled back into view.
export const sentenceViews = new Map<string, RefObject<HostInstance | null>>();

type Props = { code: string; sentence: { sentenceId: string; text: string }; quote: ReactNode };

// The quote with a mark beside it (SPEC §4.1): "+" keeps the line, a check shows it is kept and removes it again. Guests sign in first.
export function SentenceAction({ code, sentence, quote }: Props) {
  const router = useRouter();
  const me = useMe();
  const saved = useSavedSentences(code);
  const toggle = useKeepToggle(code, sentence.sentenceId, sentence.text);
  const kept = saved.has(sentence.sentenceId);
  const viewRef = useRef<HostInstance>(null);
  useEffect(() => {
    sentenceViews.set(sentence.sentenceId, viewRef);
    return () => void sentenceViews.delete(sentence.sentenceId);
  }, [sentence.sentenceId]);
  const loginThenSave = async () => {
    await savePendingAction({ kind: "SCRAP_SAVE", exhibitionCode: code, sentenceId: sentence.sentenceId });
    router.push({ pathname: "/login", params: { returnTo: `/e/${code}` } });
  };
  const press = !me ? () => void loginThenSave() : kept ? toggle.unkeep : toggle.keep;
  return (
    <View ref={viewRef} style={{ gap: spacing.inset }}>
      <View style={styles.row}>
        <View style={[styles.quote, kept && styles.kept]}>{quote}</View>
        <KeepMark kept={kept} pending={toggle.pending} hint={!me ? scrapStrings.signInHint : undefined} onPress={press} />
      </View>
      {toggle.keepFailed && !kept && <Notice message={scrapStrings.saveFailed} error action={{ label: scrapStrings.retry, onPress: toggle.keep }} />}
      {toggle.unkeepFailed && kept && <Notice message={scrapStrings.removeFailed} error action={{ label: scrapStrings.retry, onPress: toggle.unkeep }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.tight },
  quote: { flex: 1 },
  // A kept line carries a black rule at its left edge.
  kept: { borderLeftWidth: 1, borderLeftColor: colors.black, paddingLeft: spacing.tight },
});
