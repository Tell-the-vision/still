import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { Fragment, useState } from "react";
import { Platform } from "react-native";
import { authStrings } from "../auth/strings";
import { useGoogleAuthCode } from "../auth/use-google-auth";
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
  const google = useGoogleAuthCode();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.identity.pathKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.me.pathKey() }),
    ]);
  const unlink = useMutation(trpc.identity.delete.mutationOptions({ onSettled: refresh }));
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
  const link = useMutation(trpc.identity.create.mutationOptions({ onSuccess: refresh }));
  const linkNative = async () => {
    try {
      const credentials = await google.start();
      if (!credentials) return;
      const { created } = await link.mutateAsync(credentials);
      setError(created ? null : authStrings.link.exists);
    } catch (e) {
      const conflict = e instanceof TRPCClientError && e.data?.appCode === "IDENTITY_ALREADY_LINKED";
      setError(conflict ? authStrings.link.conflict : authStrings.link.failed);
    }
  };
  const startLink = () =>
    Platform.OS === "web" ? window.location.assign("/api/auth/google?" + new URLSearchParams({ intent: "link", returnTo: "/account" })) : linkNative();
  return (
    <>
      {data?.map((identity) => (
        <Fragment key={identity.id}>
          <Text>{accountStrings.identityRow("Google", identity.email)}</Text>
          <Button label={accountStrings.unlink} variant="secondary" onPress={() => setConfirmingId(identity.id)} />
        </Fragment>
      ))}
      <Button label={accountStrings.linkAnother} trailing="→" variant="secondary" disabled={link.isPending || (Platform.OS !== "web" && !google.ready)} onPress={startLink} />
      {error ? <Notice error message={error} /> : null}
      <Dialog label={accountStrings.unlinkDialogLabel} visible={confirmingId !== null} onClose={() => setConfirmingId(null)}>
        <Text>{accountStrings.unlinkWarning}</Text>
        <Button label={accountStrings.cancel} variant="secondary" onPress={() => setConfirmingId(null)} />
        <Button label={accountStrings.unlink} disabled={unlink.isPending} onPress={confirm} />
      </Dialog>
    </>
  );
}
