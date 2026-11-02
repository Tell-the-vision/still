import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTRPC } from "../../lib/trpc";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { KeepsakeCard } from "../../ui/KeepsakeCard";
import { Notice } from "../../ui/Notice";
import { Section } from "../../ui/Section";
import { Stack } from "../../ui/Stack";
import { Text } from "../../ui/Text";
import { keepsakeStrings } from "./strings";

// The web card on Archive Detail: the saved card, or an empty note, plus the way to the creator.
export function KeepsakeSection({ code }: { code: string }) {
  const trpc = useTRPC();
  const { data: keepsake } = useQuery(trpc.keepsake.get.queryOptions({ code }));
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation(
    trpc.keepsake.delete.mutationOptions({
      onSuccess: () => {
        queryClient.setQueryData(trpc.keepsake.get.queryKey({ code }), null);
        void queryClient.invalidateQueries({ queryKey: trpc.archive.pathKey() });
      },
      onSettled: () => setConfirming(false),
    }),
  );
  const href = `/archive/${code}/keepsake` as const;
  if (keepsake === undefined) return null;
  if (keepsake === null) {
    return (
      <Section label={keepsakeStrings.none}>
        <Stack>
          <Text variant="secondary">{keepsakeStrings.empty}</Text>
          <Button label={keepsakeStrings.create} trailing="→" href={href} />
        </Stack>
      </Section>
    );
  }
  return (
    <Section label={keepsakeStrings.present}>
      <Stack>
        <KeepsakeCard card={keepsake.card} templateId={keepsake.templateId} />
        <Button label={keepsakeStrings.edit} trailing="→" href={href} />
        <Button label={keepsakeStrings.delete} variant="secondary" onPress={() => setConfirming(true)} />
        {remove.isError && <Notice error message={keepsakeStrings.deleteFailed} />}
        <Dialog visible={confirming} onClose={() => setConfirming(false)} label={keepsakeStrings.delete}>
          <Button label={keepsakeStrings.confirm} disabled={remove.isPending} onPress={() => remove.mutate({ code })} />
          <Button label={keepsakeStrings.cancel} variant="secondary" onPress={() => setConfirming(false)} />
        </Dialog>
      </Stack>
    </Section>
  );
}
