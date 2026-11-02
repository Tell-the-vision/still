import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { queryPath, useTRPC } from "../../lib/trpc";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { Notice } from "../../ui/Notice";
import { Text } from "../../ui/Text";
import { archiveStrings } from "./strings";

// Cache entries of this exhibition that die with the archive. Matched by path so later procedures need no edit here.
const AFTER_DELETE = { "archive.get": null, "journal.get": null, "keepsake.get": null, "scrap.list": [] };

export function DeleteArchive({ code }: { code: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const remove = useMutation(trpc.archive.delete.mutationOptions());
  const confirm = async () => {
    setConfirming(false);
    try {
      await remove.mutateAsync({ code });
    } catch {
      setFailed(true);
      return;
    }
    router.replace("/archive");
    for (const [path, value] of Object.entries(AFTER_DELETE)) {
      queryClient.setQueriesData({ predicate: (q) => queryPath(q.queryKey) === path && (q.queryKey[1] as { input?: { code?: string } } | undefined)?.input?.code === code }, value);
    }
    await queryClient.invalidateQueries({ queryKey: trpc.archive.pathKey() });
  };
  return (
    <>
      <Button label={archiveStrings.delete} trailing="→" variant="secondary" disabled={remove.isPending} onPress={() => setConfirming(true)} />
      {failed ? <Notice error message={archiveStrings.deleteFailed} /> : null}
      <Dialog label={archiveStrings.delete} visible={confirming} onClose={() => setConfirming(false)}>
        <Text>{archiveStrings.deleteWarning}</Text>
        <Button label={archiveStrings.cancel} variant="secondary" onPress={() => setConfirming(false)} />
        <Button label={archiveStrings.confirmDelete} onPress={confirm} />
      </Dialog>
    </>
  );
}
