import { track } from "../../lib/analytics";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useWindowDimensions } from "react-native";
import { useTRPC } from "../../lib/trpc";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { KeepsakeCard } from "../../ui/KeepsakeCard";
import { Notice } from "../../ui/Notice";
import { Section } from "../../ui/Section";
import { Stack } from "../../ui/Stack";
import { Text } from "../../ui/Text";
import { TextAction } from "../../ui/TextAction";
import { card as cardTokens, spacing } from "../../ui/theme";
import { DownloadPng } from "./DownloadPng";
import { keepsakeQueryOptions } from "./keepsakeQuery";
import { keepsakeStrings } from "./strings";

// The web card on Archive Detail: the saved card, or an empty note, plus the way to the creator.
export function KeepsakeSection({ code }: { code: string }) {
  const trpc = useTRPC();
  const { data: keepsake } = useQuery(keepsakeQueryOptions(trpc, code));
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation(
    trpc.keepsake.delete.mutationOptions({
      onSuccess: () => {
        track("keepsake_delete", { exhibition_code: code, template_id: keepsake?.templateId ?? "" });
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
      <Section labelVariant="row" label={keepsakeStrings.none}>
        <Stack>
          <Text variant="secondary">{keepsakeStrings.empty}</Text>
          <TextAction label={keepsakeStrings.create} trailing="→" href={href} />
        </Stack>
      </Section>
    );
  }
  return (
    <Section labelVariant="row" label={keepsakeStrings.present}>
      <Stack>
        <KeepsakeCard card={keepsake.card} templateId={keepsake.templateId} width={Math.min(width - 2 * spacing.gutter, cardTokens.width)} />
        <DownloadPng code={code} url={keepsake.png.url} />
        <TextAction label={keepsakeStrings.edit} trailing="→" href={href} />
        <TextAction label={keepsakeStrings.delete} tone="secondary" onPress={() => setConfirming(true)} />
        {remove.isError && <Notice error message={keepsakeStrings.deleteFailed} />}
        <Dialog visible={confirming} onClose={() => setConfirming(false)} label={keepsakeStrings.delete} body={keepsakeStrings.dialogBody}>
          <Button label={keepsakeStrings.confirm} disabled={remove.isPending} onPress={() => remove.mutate({ code })} />
          <Button label={keepsakeStrings.cancel} variant="secondary" onPress={() => setConfirming(false)} />
        </Dialog>
      </Stack>
    </Section>
  );
}
