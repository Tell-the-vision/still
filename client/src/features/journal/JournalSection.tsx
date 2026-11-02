import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useMe } from "../auth/use-me";
import { useTRPC } from "../../lib/trpc";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { Notice } from "../../ui/Notice";
import { Section } from "../../ui/Section";
import { Stack } from "../../ui/Stack";
import { Text } from "../../ui/Text";
import { useDraft } from "./drafts";
import { journalSectionStrings as strings } from "./strings";

// Archive Detail section: the saved journal with Edit and Delete, or an invitation to write one.
export function JournalSection({ code }: { code: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: journal } = useQuery(trpc.journal.get.queryOptions({ code }));
  const draft = useDraft(code, useMe()?.id ?? null);
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation(
    trpc.journal.delete.mutationOptions({
      onSuccess: () => {
        setConfirming(false);
        draft.discard();
        queryClient.setQueryData(trpc.journal.get.queryKey({ code }), null);
        void queryClient.invalidateQueries({ queryKey: trpc.archive.pathKey() });
      },
      onError: () => setConfirming(false),
    }),
  );
  if (journal === undefined) return null;
  const href = `/e/${code}/journal` as const;
  if (journal === null) {
    return (
      <Section label={strings.absent}>
        <Button label={strings.write} trailing="→" href={href} />
      </Section>
    );
  }
  return (
    <Section label={strings.present}>
      <Stack>
        <Text numberOfLines={3}>{journal.content}</Text>
        <Button label={strings.edit} trailing="→" href={href} />
        <Button label={strings.delete} variant="secondary" onPress={() => setConfirming(true)} />
        {remove.isError && <Notice error message={strings.failed} />}
      </Stack>
      <Dialog visible={confirming} onClose={() => setConfirming(false)} label={strings.delete}>
        <Button label={strings.confirm} onPress={() => remove.mutate({ code })} />
        <Button label={strings.cancel} variant="secondary" onPress={() => setConfirming(false)} />
      </Dialog>
    </Section>
  );
}
