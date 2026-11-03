import { track } from "../../lib/analytics";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTRPC } from "../../lib/trpc";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { Notice } from "../../ui/Notice";
import { Stack } from "../../ui/Stack";
import { TextAction } from "../../ui/TextAction";
import { DownloadPng } from "./DownloadPng";
import { KeepsakePresence } from "./KeepsakePresence";
import { keepsakeQueryOptions } from "./keepsakeQuery";
import { keepsakeStrings } from "./strings";

// The keepsake on Archive Detail: the shared panel, plus download and delete once a card is saved.
export function KeepsakeSection({ code, exhibition }: { code: string; exhibition: Parameters<typeof KeepsakePresence>[0]["exhibition"] }) {
  const trpc = useTRPC();
  const { data: keepsake } = useQuery(keepsakeQueryOptions(trpc, code));
  const queryClient = useQueryClient();
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
  if (keepsake === undefined) return null;
  return (
    <Stack>
        <KeepsakePresence code={code} exhibition={exhibition} hasGuide where="archive" />
        {keepsake && (
          <Stack direction="row" gap="section" justify="center">
            <DownloadPng code={code} url={keepsake.png.url} />
            <TextAction label={keepsakeStrings.delete} tone="secondary" onPress={() => setConfirming(true)} />
          </Stack>
        )}
        {remove.isError && <Notice error message={keepsakeStrings.deleteFailed} />}
        <Dialog visible={confirming} onClose={() => setConfirming(false)} label={keepsakeStrings.delete} body={keepsakeStrings.dialogBody}>
          <Button label={keepsakeStrings.confirm} disabled={remove.isPending} onPress={() => remove.mutate({ code })} />
          <Button label={keepsakeStrings.cancel} variant="secondary" onPress={() => setConfirming(false)} />
        </Dialog>
    </Stack>
  );
}
