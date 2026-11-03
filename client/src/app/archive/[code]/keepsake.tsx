import { track } from "../../../lib/analytics";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useWindowDimensions } from "react-native";
import { templateDefaults } from "@still/shared/keepsake";
import { useRequireLogin } from "../../../features/auth/require-login";
import { keepsakeStrings as strings } from "../../../features/keepsake/strings";
import { useTRPC } from "../../../lib/trpc";
import { Button } from "../../../ui/Button";
import { KeepsakeCard } from "../../../ui/KeepsakeCard";
import { Notice } from "../../../ui/Notice";
import { Screen } from "../../../ui/Screen";
import { Stack } from "../../../ui/Stack";
import { Text } from "../../../ui/Text";
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
  const { data: archive } = useQuery(trpc.archive.get.queryOptions({ code }, { enabled }));
  const { data: scraps } = useQuery(trpc.scrap.list.queryOptions({ code }, { enabled }));
  const { data: journal } = useQuery(trpc.journal.get.queryOptions({ code }, { enabled }));
  const { data: saved } = useQuery(trpc.keepsake.get.queryOptions({ code }, { enabled }));
  const [picked, setPicked] = useState<string>();
  const [sentenceIds, setSentenceIds] = useState<string[]>([]);
  const [excerpt, setExcerpt] = useState<string>();
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
        <Text variant="title">{strings.heading}</Text>
        {strings.templates.map((t) => (
          <Button key={t.id} label={t.label} variant="secondary" selected={t.id === templateId} onPress={() => setPicked(t.id)} />
        ))}
        {templateId !== "cover" && (
          <>
            <Text variant="title">{strings.sentencesHeading}</Text>
            {scraps.map((s) => (
              <Button
                key={s.sentenceId}
                label={s.content}
                variant="secondary"
                selected={sentenceIds.includes(s.sentenceId)}
                disabled={!sentenceIds.includes(s.sentenceId) && sentenceIds.length >= 3}
                onPress={() => toggleSentence(s.sentenceId)}
              />
            ))}
          </>
        )}
        {templateId === "reflection" && (
          <>
            <Text variant="title">{strings.excerptHeading}</Text>
            {paragraphs.map((p) => (
              <Button key={p} label={p} variant="secondary" selected={p === excerpt} onPress={() => setExcerpt(p === excerpt ? undefined : p)} />
            ))}
          </>
        )}
        <KeepsakeCard card={card} templateId={templateId} width={Math.min(width - 2 * spacing.gutter, cardTokens.width)} />
        {save.isError && <Notice error message={strings.failed} />}
        <Button label={strings.save} onPress={() => save.mutate({ code, templateId, ...picks })} />
      </Stack>
    </Screen>
  );
}
