import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { journalStrings } from "../../../features/journal/strings";
import { useTRPC } from "../../../lib/trpc";
import { Button } from "../../../ui/Button";
import { Notice } from "../../../ui/Notice";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import { TextField } from "../../../ui/TextField";

// Journal 05 (SPEC §5). Signed-in only here; guest save arrives later.
export default function Journal() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const exhibition = useQuery(trpc.exhibition.get.queryOptions({ code }));
  const journal = useQuery(trpc.journal.get.queryOptions({ code }));
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const content = draft ?? journal.data?.content ?? "";
  const save = useMutation(
    trpc.journal.upsert.mutationOptions({
      onSuccess: (r) => {
        queryClient.setQueryData(trpc.journal.get.queryKey({ code }), r.journal);
        if (r.created) void queryClient.invalidateQueries({ queryKey: trpc.archive.pathKey() });
        setDraft(null);
        setSaved(true);
      },
    }),
  );
  const { audioType = null, revision = null } = journal.data ?? {};

  return (
    <Screen tabs>
      <Text variant="title">{exhibition.data?.title ?? ""}</Text>
      <Text variant="secondary">{journalStrings.heading}</Text>
      {journal.isSuccess && (
        <TextField multiline label={journalStrings.label} value={content} onChangeText={(text) => { setDraft(text); setSaved(false); }} />
      )}
      <Button label={journalStrings.save} disabled={save.isPending} onPress={() => save.mutate({ code, content, audioType, revision })} />
      {saved && <Notice message={journalStrings.saved} />}
    </Screen>
  );
}
