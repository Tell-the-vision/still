import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { savePendingAction, takePendingAction } from "../../../features/auth/pending-action";
import { takeGuestDraft, useDraft } from "../../../features/journal/drafts";
import { useMe } from "../../../features/auth/use-me";
import { journalStrings } from "../../../features/journal/strings";
import { useTRPC } from "../../../lib/trpc";
import { Button } from "../../../ui/Button";
import { Notice } from "../../../ui/Notice";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import { TextField } from "../../../ui/TextField";

// Journal 05 (SPEC §5). A guest's Save goes to login first.
export default function Journal() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const me = useMe();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const exhibition = useQuery(trpc.exhibition.get.queryOptions({ code }));
  const journal = useQuery(trpc.journal.get.queryOptions({ code }));
  const drafts = useDraft(code, me?.id ?? null);
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const content = draft ?? drafts.restored ?? journal.data?.content ?? "";
  const save = useMutation(
    trpc.journal.upsert.mutationOptions({
      onSuccess: (r) => {
        queryClient.setQueryData(trpc.journal.get.queryKey({ code }), r.journal);
        if (r.created) void queryClient.invalidateQueries({ queryKey: trpc.archive.pathKey() });
        setDraft(null);
        drafts.discard();
        setSaved(true);
      },
      // The local text stays in the field; refetching gives the next save the new revision.
      onError: (error) => {
        if (error instanceof TRPCClientError && error.data?.appCode === "REVISION_MISMATCH") void journal.refetch();
      },
    }),
  );
  const { audioType = null, revision = null } = journal.data ?? {};
  const error = save.error instanceof TRPCClientError ? save.error : null;
  const appCode = error?.data?.appCode;
  const isNetworkError = !!error && !error.data;

  // After login the guest's pending JOURNAL_SAVE saves the guest draft (SPEC §2.2 Sign in 8).
  const consent = useQuery(trpc.consent.get.queryOptions(undefined, { enabled: !!me }));
  const ran = useRef(false);
  const ready = !!me && !!consent.data && !journal.isPending && drafts.restored !== undefined;
  useEffect(() => {
    if (!ready || ran.current) return;
    ran.current = true;
    void (async () => {
      const action = await takePendingAction({ kind: "JOURNAL_SAVE", exhibitionCode: code });
      const text = action && action !== "expired" ? await takeGuestDraft(code) : null;
      if (text === null) return;
      // Kept as the user's draft until the save succeeds.
      setDraft(text);
      drafts.save(text);
      save.mutate({ code, content: text, audioType, revision });
    })();
  });

  const submit = async () => {
    if (!me) {
      drafts.flush();
      await savePendingAction({ kind: "JOURNAL_SAVE", exhibitionCode: code });
      return router.push({ pathname: "/login", params: { returnTo: `/e/${code}/journal` } });
    }
    setSaved(false);
    save.mutate({ code, content, audioType, revision });
  };

  return (
    <Screen tabs>
      <Text variant="title">{exhibition.data?.title ?? ""}</Text>
      <Text variant="secondary">{journalStrings.heading}</Text>
      {!journal.isPending && drafts.restored !== undefined && (
        <TextField multiline label={journalStrings.label} value={content} onChangeText={(text) => { setDraft(text); drafts.save(text); setSaved(false); }} />
      )}
      <Button label={journalStrings.save} disabled={save.isPending} onPress={submit} />
      {appCode === "JOURNAL_INVALID" && <Notice error message={journalStrings.invalid} />}
      {isNetworkError && <Notice error message={journalStrings.network} />}
      {isNetworkError && <Button label={journalStrings.retry} variant="secondary" onPress={submit} />}
      {appCode === "REVISION_MISMATCH" && <Notice message={journalStrings.conflict} />}
      {saved && <Notice message={journalStrings.saved} />}
    </Screen>
  );
}
