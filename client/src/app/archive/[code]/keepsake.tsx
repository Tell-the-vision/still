import { track } from "../../../lib/analytics";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useWindowDimensions } from "react-native";
import { templateDefaults } from "@still/shared/keepsake";
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
  const [picked, setPicked] = useState<string>();
  const [sentenceIds, setSentenceIds] = useState<string[]>([]);
  const [excerpt, setExcerpt] = useState<string>();
  const changed = picked !== undefined || sentenceIds.length > 0 || excerpt !== undefined;
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
  const picks = {
    sentenceIds: templateId !== "cover" && sentenceIds.length > 0 ? sentenceIds : undefined,
    journalExcerpt: templateId === "reflection" ? excerpt : undefined,
  };
  const card = {
    exhibition,
    image: exhibition.coverImage,
    sentences: picks.sentenceIds ? picks.sentenceIds.flatMap((id) => scraps.filter((s) => s.sentenceId === id)) : defaults.sentences,
    journalExcerpt: picks.journalExcerpt ?? defaults.journalExcerpt,
  };
  const paragraphs = (journal?.content ?? "").split("\n").filter((p) => p.trim() !== "");
  const toggleSentence = (id: string) => setSentenceIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));
  return (
    <Screen tabs>
      <Stack>
        <Text variant="eyebrow">{strings.eyebrow}</Text>
        <Text variant="headline">{strings.heading}</Text>
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
              <Text variant="secondary">{sentenceIds.length >= 3 ? strings.threeChosen : strings.chooseUpTo}</Text>
              {scraps.map((s) => (
                <Choice
                  key={s.sentenceId}
                  label={s.content}
                  role="checkbox"
                  textVariant="action"
                  selected={sentenceIds.includes(s.sentenceId)}
                  disabled={!sentenceIds.includes(s.sentenceId) && sentenceIds.length >= 3}
                  onPress={() => toggleSentence(s.sentenceId)}
                />
              ))}
              {templateId === "reflection" && (
                <>
                  <Text variant="label">{strings.excerptHeading}</Text>
                  {paragraphs.map((p) => (
                    <Choice key={p} label={p} role="radio" selected={p === excerpt} onPress={() => setExcerpt(p === excerpt ? undefined : p)} />
                  ))}
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
