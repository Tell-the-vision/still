import { track } from "../../../lib/analytics";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useWindowDimensions } from "react-native";
import { clipExcerpt, sentenceLimit, templateDefaults } from "@still/shared/keepsake";
import { useRequireLogin } from "../../../features/auth/require-login";
import { keepsakeStrings as strings } from "../../../features/keepsake/strings";
import { useTRPC } from "../../../lib/trpc";
import { DownloadPng } from "../../../features/keepsake/DownloadPng";
import { Button } from "../../../ui/Button";
import { Choice } from "../../../ui/Choice";
import { KeepsakeCard } from "../../../ui/KeepsakeCard";
import { Notice } from "../../../ui/Notice";
import { Screen } from "../../../ui/Screen";
import { Section } from "../../../ui/Section";
import { Stack } from "../../../ui/Stack";
import { Text } from "../../../ui/Text";
import { TextAction } from "../../../ui/TextAction";
import { card as cardTokens, spacing } from "../../../ui/theme";

// Web card creator: pick a template, preview it live, save.
export default function KeepsakeCreator() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const me = useRequireLogin(`/archive/${code}/keepsake`);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const enabled = Boolean(me);
  const archiveQuery = useQuery(trpc.archive.get.queryOptions({ code }, { enabled }));
  const scrapsQuery = useQuery(trpc.scrap.list.queryOptions({ code }, { enabled }));
  const journalQuery = useQuery(trpc.journal.get.queryOptions({ code }, { enabled }));
  const savedQuery = useQuery(trpc.keepsake.get.queryOptions({ code }, { enabled }));
  const { data: archive } = archiveQuery;
  const { data: scraps } = scrapsQuery;
  const { data: journal } = journalQuery;
  const { data: saved } = savedQuery;
  const failed = [archiveQuery, scrapsQuery, journalQuery, savedQuery].filter((q) => q.isError);
  // `undefined` means untouched: the picks then come from the saved card, so editing starts where it was left.
  const [picked, setPicked] = useState<string>();
  const [sentenceIds, setSentenceIds] = useState<string[]>();
  const [excerpt, setExcerpt] = useState<string | null>();
  const changed = picked !== undefined || sentenceIds !== undefined || excerpt !== undefined;
  const templateId = picked ?? saved?.templateId ?? "sentence";
  const save = useMutation(
    trpc.keepsake.upsert.mutationOptions({
      onSuccess: (r, variables) => {
        track("keepsake_save", { exhibition_code: code, template_id: variables.templateId });
        queryClient.setQueryData(trpc.keepsake.get.queryKey({ code }), r.keepsake);
        if (r.created) void queryClient.invalidateQueries({ queryKey: trpc.archive.pathKey() });
        router.replace(`/archive/${code}`);
      },
    }),
  );
  if (failed.length > 0) {
    const retry = () => failed.forEach((q) => void q.refetch());
    return (
      <Screen tabs>
        <Notice error message={strings.loadFailed} action={{ label: "Retry", onPress: retry }} />
      </Screen>
    );
  }
  if (!archive || !scraps || journal === undefined) return <Screen tabs>{null}</Screen>;
  const { exhibition } = archive;
  const defaults = templateDefaults(templateId, scraps, journal?.content ?? null);
  // Saved picks that still exist: a sentence unsaved since, or an excerpt no longer in the journal, would fail the save.
  const savedSentenceIds = (saved?.card.sentences ?? []).map((s) => s.sentenceId).filter((id) => scraps.some((s) => s.sentenceId === id));
  const savedExcerpt = saved?.card.journalExcerpt;
  const keptExcerpt = savedExcerpt && journal?.content.normalize("NFC").includes(savedExcerpt) ? savedExcerpt : null;
  const chosenIds = sentenceIds ?? savedSentenceIds;
  // Only as many picks as the template shows count; extra ones wait in case the layout changes back.
  const limit = sentenceLimit(templateId);
  const shownIds = chosenIds.slice(0, limit);
  const chosenExcerpt = excerpt === undefined ? keptExcerpt : excerpt;
  const picks = {
    sentenceIds: shownIds.length > 0 ? shownIds : undefined,
    journalExcerpt: templateId === "reflection" ? (chosenExcerpt ?? undefined) : undefined,
  };
  const card = {
    exhibition,
    image: exhibition.coverImage,
    sentences: picks.sentenceIds ? picks.sentenceIds.flatMap((id) => scraps.filter((s) => s.sentenceId === id)) : defaults.sentences,
    journalExcerpt: picks.journalExcerpt ?? defaults.journalExcerpt,
  };
  const paragraphs = (journal?.content ?? "").split("\n").filter((p) => p.trim() !== "");
  const toggleSentence = (id: string) => setSentenceIds(shownIds.includes(id) ? shownIds.filter((i) => i !== id) : [...shownIds, id]);
  const full = shownIds.length >= limit;
  const countNote = limit === 1 ? (full ? strings.oneChosen : strings.chooseOne) : full ? strings.threeChosen : strings.chooseUpTo;
  return (
    <Screen tabs>
      <Stack>
        <Text variant="headline">{strings.heading}</Text>
        <Text variant="eyebrow">{strings.eyebrow}</Text>
        <KeepsakeCard card={card} templateId={templateId} width={Math.min(width - 2 * spacing.gutter, cardTokens.width)} />
        <Text variant="label">{strings.layoutLabel}</Text>
        <Stack direction="row">
          {strings.templates.map((t) => (
            <Choice key={t.id} layout="tile" role="radio" label={t.label} selected={t.id === templateId} onPress={() => setPicked(t.id)} />
          ))}
        </Stack>
        {templateId !== "cover" && (
          <Section label={strings.onTheCard}>
            <Stack gap="inset">
              <Text variant="secondary">{countNote}</Text>
              {scraps.map((s) => (
                <Choice
                  key={s.sentenceId}
                  label={s.content}
                  role="checkbox"
                  textVariant="action"
                  selected={shownIds.includes(s.sentenceId)}
                  disabled={!shownIds.includes(s.sentenceId) && full}
                  onPress={() => toggleSentence(s.sentenceId)}
                />
              ))}
              {templateId === "reflection" && (
                <>
                  <Text variant="label">{strings.excerptHeading}</Text>
                  {paragraphs.map((p) => {
                    // A paragraph longer than the card holds is offered as its start; "…" marks the cut.
                    const clipped = clipExcerpt(p);
                    return (
                      <Choice
                        key={p}
                        label={clipped.length < p.length ? `${clipped}…` : p}
                        role="radio"
                        selected={clipped === chosenExcerpt}
                        onPress={() => setExcerpt(clipped === chosenExcerpt ? null : clipped)}
                      />
                    );
                  })}
                </>
              )}
            </Stack>
          </Section>
        )}
        {save.isError && <Notice error message={strings.failed} />}
        <Button label={strings.save} onPress={() => save.mutate({ code, templateId, ...picks })} />
        {saved && !changed ? (
          <DownloadPng code={code} url={saved.png.url} />
        ) : (
          <TextAction label={strings.png.download} leading="↓" disabled onPress={() => undefined} />
        )}
      </Stack>
    </Screen>
  );
}
