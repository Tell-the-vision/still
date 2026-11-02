import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { Fragment, useState } from "react";
import { Platform } from "react-native";
import { STALE_TIME, useTRPC } from "../../lib/trpc";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { Notice } from "../../ui/Notice";
import { Text } from "../../ui/Text";
import { accountStrings } from "./strings";

// Every Google identity linked to this user, each with an unlink action (SPEC §2.2 Linked accounts).
export function LinkedAccounts() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data } = useQuery(trpc.identity.list.queryOptions(undefined, { staleTime: STALE_TIME.personal }));
  const unlink = useMutation(
    trpc.identity.delete.mutationOptions({
      onSettled: () =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: trpc.identity.pathKey() }),
          queryClient.invalidateQueries({ queryKey: trpc.me.pathKey() }),
        ]),
    }),
  );
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    if (!confirmingId) return;
    const identityId = confirmingId;
    setConfirmingId(null);
    try {
      await unlink.mutateAsync({ identityId });
      setError(null);
    } catch (e) {
      const last = e instanceof TRPCClientError && e.data?.appCode === "LAST_IDENTITY";
      setError(last ? accountStrings.lastIdentity : accountStrings.unlinkFailed);
    }
  };
  const startLink = () => window.location.assign("/api/auth/google?" + new URLSearchParams({ intent: "link", returnTo: "/account" }));
  return (
    <>
      {data?.map((identity) => (
        <Fragment key={identity.id}>
          <Text>{accountStrings.identityRow("Google", identity.email)}</Text>
          <Button label={accountStrings.unlink} variant="secondary" onPress={() => setConfirmingId(identity.id)} />
        </Fragment>
      ))}
      {Platform.OS === "web" ? <Button label={accountStrings.linkAnother} trailing="→" variant="secondary" onPress={startLink} /> : null}
      {error ? <Notice error message={error} /> : null}
      <Dialog label={accountStrings.unlinkDialogLabel} visible={confirmingId !== null} onClose={() => setConfirmingId(null)}>
        <Text>{accountStrings.unlinkWarning}</Text>
        <Button label={accountStrings.cancel} variant="secondary" onPress={() => setConfirmingId(null)} />
        <Button label={accountStrings.unlink} disabled={unlink.isPending} onPress={confirm} />
      </Dialog>
    </>
  );
}
