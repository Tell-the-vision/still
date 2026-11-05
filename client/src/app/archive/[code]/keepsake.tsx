import { track } from "../../../lib/analytics";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, ScrollView, useWindowDimensions, View, type ViewStyle } from "react-native";
import { EXCERPT_MAX, sentenceLimit } from "@still/shared/keepsake";
import { useRequireLogin } from "../../../features/auth/require-login";
import { keepsakePageOf, pageOf } from "../../../features/guide/pages";
import { keepsakeStrings as strings } from "../../../features/keepsake/strings";
import { useTRPC } from "../../../lib/trpc";
import { focusVisible } from "../../../ui/focusVisible";
import { Button } from "../../../ui/Button";
import { Choice } from "../../../ui/Choice";
import { KeepsakeCard } from "../../../ui/KeepsakeCard";
import { KeepsakeMini } from "../../../ui/KeepsakeThumb";
import { Notice } from "../../../ui/Notice";
import { Screen } from "../../../ui/Screen";
import { Stack } from "../../../ui/Stack";
import { Text } from "../../../ui/Text";
import { TextField } from "../../../ui/TextField";
import { card as cardTokens, colors, focusRing, fontFamily, spacing } from "../../../ui/theme";

// The card is drawn no wider than this, so the note under it is in view as soon as the screen opens.
const PREVIEW_MAX = 300;
// The designs are shown as the card itself at this scale (72 by 96).
const MINI_SCALE = 0.2;

// The house design, then its variations (template ids, shared/src/keepsake.ts): what leads, or where the picture sits.
const DESIGNS = [
  { id: "still", name: "still", needsPicture: false },
  { id: "quote", name: "quote", needsPicture: false },
  { id: "reflection", name: "note", needsPicture: false },
  { id: "sentence/full", name: "plate", needsPicture: true },
  { id: "reflection/none", name: "words", needsPicture: true },
] as const;

/**
 * Making one artwork's card (?page=, the first 8 characters of its content id), and writing about the work while doing
 * it. The card leads; under it the note, which goes on the card and into the visit's journal; then the lines on the
 * card in the order they are tapped, and its design (the house design or a variation). Saving writes the note into the journal
 * (in place of the one this card had, or as a new paragraph under the work's title), then the card.
 */
export default function KeepsakeCreator() {
  const { code, from, page = "" } = useLocalSearchParams<{ code: string; from?: string; page?: string }>();
  const fromGuide = from === "guide";
  const me = useRequireLogin(`/archive/${code}/keepsake?from=${fromGuide ? "guide" : "archive"}&page=${page}`);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const enabled = Boolean(me);
  const archiveQuery = useQuery(trpc.archive.get.queryOptions({ code }, { enabled }));
  const guideQuery = useQuery(trpc.guide.get.queryOptions({ code }, { enabled }));
  const scrapsQuery = useQuery(trpc.scrap.list.queryOptions({ code }, { enabled }));
  const journalQuery = useQuery(trpc.journal.get.queryOptions({ code }, { enabled }));
  const savedQuery = useQuery(trpc.keepsake.get.queryOptions({ code, page }, { enabled }));
  const { data: archive } = archiveQuery;
  const { data: journal } = journalQuery;
  const { data: saved } = savedQuery;
  const failed = [archiveQuery, guideQuery, scrapsQuery, journalQuery, savedQuery].filter((q) => q.isError);
  // The page the card is about, and only the lines kept on it.
  const pageDoc = guideQuery.data ? pageOf(guideQuery.data.document, page) : null;
  const shown = pageDoc ? keepsakePageOf(pageDoc, page) : null;
  const scraps = shown ? scrapsQuery.data?.filter((s) => shown.sentenceIds.has(s.sentenceId)) : undefined;

  // `undefined` means untouched: the card then shows what was saved, so editing starts where it was left.
  const [design, setDesign] = useState<string>();
  const [order, setOrder] = useState<string[]>();
  const [note, setNote] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // The tallest the screen has been: a shorter layout keeps this height, so a scrolled page is not pulled up.
  const [tallest, setTallest] = useState(0);

  const saveJournal = useMutation(trpc.journal.upsert.mutationOptions());
  const saveCard = useMutation(trpc.keepsake.upsert.mutationOptions());

  if (failed.length > 0) {
    const retry = () => failed.forEach((q) => void q.refetch());
    return (
      <Screen tabs>
        <Notice error message={strings.loadFailed} action={{ label: "Retry", onPress: retry }} />
      </Screen>
    );
  }
  if (guideQuery.data && !shown) {
    return (
      <Screen tabs>
        <Notice error message={strings.pageMissing} />
      </Screen>
    );
  }
  if (!archive || !shown || !scraps || journal === undefined || saved === undefined) return <Screen tabs>{null}</Screen>;

  // The house design first, then its variations; those that only change the picture need one.
  const designs = DESIGNS.filter((d) => shown.image || !d.needsPicture);
  const templateId = design ?? saved?.templateId ?? designs[0].id;
  const limit = sentenceLimit(templateId);
  // Saved picks that are still kept: a line removed since would fail the save. Untouched and never saved, the first line.
  const savedIds = (saved?.card.sentences ?? []).map((s) => s.sentenceId).filter((id) => scraps.some((s) => s.sentenceId === id));
  const chosen = order ?? (saved ? savedIds : scraps.slice(0, 1).map((s) => s.sentenceId));
  const shownIds = chosen.slice(0, limit);
  const savedNote = saved?.card.journalExcerpt ?? "";
  const noteText = note ?? savedNote;
  const trimmedNote = noteText.trim();
  const card = {
    exhibition: { ...archive.exhibition, title: shown.title },
    image: shown.image,
    sentences: shownIds.flatMap((id) => scraps.filter((s) => s.sentenceId === id)),
    journalExcerpt: trimmedNote || null,
  };
  // The designs' previews: this card's picture and note, and its kept line even when it is off the card.
  const sample = { ...card, sentences: card.sentences.length ? card.sentences : scraps.slice(0, 1) };

  // Tapping adds a line at the end of the card's order; tapping a line on the card takes it off.
  const toggleLine = (id: string) => setOrder(shownIds.includes(id) ? shownIds.filter((i) => i !== id) : [...shownIds, id].slice(-limit));

  const save = async () => {
    setSaving(true);
    setSaveFailed(false);
    try {
      // The note joins the visit's journal: in place of the one this card had, or as a new paragraph under the title.
      if (trimmedNote) {
        const current = journal?.content ?? "";
        const content = savedNote && current.includes(savedNote)
          ? current.replace(savedNote, trimmedNote)
          : [current.trimEnd(), `${shown.title}\n${trimmedNote}`].filter(Boolean).join("\n\n");
        if (content !== current) {
          const r = await saveJournal.mutateAsync({ code, content, audioType: journal?.audioType ?? null, revision: journal?.revision ?? null });
          queryClient.setQueryData(trpc.journal.get.queryKey({ code }), r.journal);
        }
      }
      const r = await saveCard.mutateAsync({ code, page, templateId, sentenceIds: shownIds.length ? shownIds : undefined, journalExcerpt: trimmedNote || undefined });
      track("keepsake_save", { exhibition_code: code, template_id: templateId, source: fromGuide ? "guide" : "archive" });
      queryClient.setQueryData(trpc.keepsake.get.queryKey({ code, page }), r.keepsake);
      void queryClient.invalidateQueries({ queryKey: trpc.keepsake.list.queryKey({ code }) });
      void queryClient.invalidateQueries({ queryKey: trpc.archive.pathKey() });
      if (router.canGoBack()) router.back();
      else router.replace(fromGuide ? `/e/${code}/${page}` : `/archive/${code}`);
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const drawnWidth = Math.min(width - 2 * spacing.gutter, PREVIEW_MAX);
  return (
    <Screen tabs>
      <View style={{ minHeight: tallest }} onLayout={(e) => setTallest((t) => Math.max(t, e.nativeEvent.layout.height))}>
        <Stack gap="section">
          <Text variant="headline">{strings.heading}</Text>

          <Settle on={templateId} style={{ width: drawnWidth, height: drawnWidth / cardTokens.aspectRatio, alignSelf: "center" }}>
            <KeepsakeCard card={card} templateId={templateId} width={drawnWidth} placeholder={strings.placeholder} />
          </Settle>

          {/* What the visitor writes goes on the card and into the visit's journal (the placeholder says so). */}
          <Stack gap="tight">
            <TextField multiline label={strings.note.label} placeholder={strings.note.placeholder} value={noteText} onChangeText={setNote} maxLength={EXCERPT_MAX} style={{ minHeight: 120, textAlignVertical: "top" }} />
            {[...noteText].length > EXCERPT_MAX - 80 && (
              <Text variant="secondary" style={{ alignSelf: "flex-end", fontVariant: ["tabular-nums"] }}>{`${[...noteText].length} / ${EXCERPT_MAX}`}</Text>
            )}
          </Stack>

          {/* The house design and its variations, each shown as this card itself; then which lines go on it. */}
          <Stack gap="inset">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.tight }} accessibilityRole="radiogroup" aria-label={strings.designs.label}>
              {designs.map((d) => (
                <Version key={d.id} label={strings.designs[d.name]} selected={d.id === templateId} card={sample} templateId={d.id} onPress={() => setDesign(d.id)} />
              ))}
            </ScrollView>
            {scraps.length > 0 && (
              <Row label={strings.lines.label}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.tight, flex: 1 }}>
                  {scraps.map((s) => {
                    const at = shownIds.indexOf(s.sentenceId);
                    return <LineChip key={s.sentenceId} text={s.content} order={at >= 0 ? at + 1 : null} onPress={() => toggleLine(s.sentenceId)} />;
                  })}
                </View>
              </Row>
            )}
          </Stack>

          <Button label={saving ? strings.saving : strings.save} disabled={saving} onPress={() => void save()} />
        </Stack>
      </View>
    </Screen>
  );
}

/** A small control with its name to the left, on one line. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.gap }}>
      <Text variant="action" tone="secondary" style={{ width: 52, paddingTop: 7 }}>{label}</Text>
      {children}
    </View>
  );
}

/** A kept line as a small toggle: on the card it is filled and numbered in the order it was tapped. */
function LineChip({ text, order, onPress }: { text: string; order: number | null; onPress: () => void }) {
  const on = order !== null;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={text}
      accessibilityState={{ checked: on }}
      aria-checked={on}
      onPress={onPress}
      style={{ maxWidth: "100%", flexDirection: "row", gap: spacing.tight, paddingHorizontal: spacing.inset, paddingVertical: 6, borderWidth: 1, borderColor: colors.black, backgroundColor: on ? colors.black : colors.white }}
    >
      {on && <Text variant="action" style={{ color: colors.white, fontVariant: ["tabular-nums"] }}>{order}</Text>}
      <Text variant="action" numberOfLines={1} style={{ flexShrink: 1, color: on ? colors.white : colors.black }}>{text}</Text>
    </Pressable>
  );
}

/** One way the card can look, shown as the card itself in miniature (what choosing it gives), and its name. */
function Version({ label, selected, disabled = false, card, templateId, onPress }: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  card: Parameters<typeof KeepsakeMini>[0]["card"];
  templateId: string;
  onPress: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected, disabled }}
      aria-checked={selected}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(focusVisible())}
      onBlur={() => setFocused(false)}
      style={[{ alignItems: "center", gap: spacing.tight, opacity: disabled ? 0.35 : 1 }, focused && focusRing]}
    >
      {/* The chosen one is held in a black frame; the others sit on white. */}
      <View style={{ padding: 3, borderWidth: 2, borderColor: selected ? colors.black : colors.white }}>
        <KeepsakeMini scale={MINI_SCALE} card={card} templateId={templateId} />
      </View>
      <Text variant="action" style={{ fontFamily: selected ? fontFamily.bodyMedium : fontFamily.body }}>{label}</Text>
    </Pressable>
  );
}

// The page's one authored motion: the card settles into its new look (a small rise from faint, 280ms, exponential
// ease-out) whenever its design changes. Reduced motion shows it at once.
function Settle({ on, style, children }: { on: string; style: ViewStyle; children: ReactNode }) {
  const progress = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) return progress.setValue(1);
      progress.setValue(0);
      Animated.timing(progress, { toValue: 1, duration: 280, easing: Easing.out(Easing.exp), useNativeDriver: true }).start();
    });
  }, [on, progress]);
  return (
    <Animated.View style={[style, { opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }), transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}
