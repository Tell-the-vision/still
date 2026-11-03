import { track } from "../../../lib/analytics";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { useLocalSearchParams, usePreventRemove, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AudioArea } from "../../../features/audio/AudioArea";
import type { displayMode } from "../../../features/audio/display-mode";
import {
  savePendingAction,
  takePendingAction,
} from "../../../features/auth/pending-action";
import { takeGuestDraft, useDraft } from "../../../features/journal/drafts";
import { useMe } from "../../../features/auth/use-me";
import { announce } from "../../../features/journal/announce";
import { journalStrings } from "../../../features/journal/strings";
import { useTRPC } from "../../../lib/trpc";
import { Button } from "../../../ui/Button";
import { Dialog } from "../../../ui/Dialog";
import { Notice } from "../../../ui/Notice";
import { Rule } from "../../../ui/Rule";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import { TextField } from "../../../ui/TextField";

// Journal 05 (SPEC §5). A guest's Save goes to login first.
export default function Journal() {
  const { code, from } = useLocalSearchParams<{
    code: string;
    from?: string;
  }>();
  const router = useRouter();
  const me = useMe();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const exhibition = useQuery(trpc.exhibition.get.queryOptions({ code }));
  const journal = useQuery(trpc.journal.get.queryOptions({ code }));
  const drafts = useDraft(code, me?.id ?? null);
  const [draft, setDraft] = useState<string | null>(null);
  // Set after a successful save: the unsaved-changes guard steps aside and the effect below leaves.
  const [done, setDone] = useState(false);
  const content = draft ?? drafts.restored ?? journal.data?.content ?? "";
  const save = useMutation(
    trpc.journal.upsert.mutationOptions({
      onSuccess: (r) => {
        track(r.created ? "journal_create" : "journal_update", {
          exhibition_code: code,
        });
        queryClient.setQueryData(
          trpc.journal.get.queryKey({ code }),
          r.journal,
        );
        if (r.created)
          void queryClient.invalidateQueries({
            queryKey: trpc.archive.pathKey(),
          });
        setDraft(null);
        drafts.discard();
        setDone(true);
      },
      // The local text stays in the field; refetching gives the next save the new revision.
      onError: (error) => {
        if (
          error instanceof TRPCClientError &&
          error.data?.appCode === "REVISION_MISMATCH"
        )
          void journal.refetch();
      },
    }),
  );
  const dirty = content !== (journal.data?.content ?? "");

  // Leaving with unsaved text asks first (also warns on web unload); Leave replays the held navigation.
  const [leave, setLeave] = useState<(() => void) | null>(null);
  usePreventRemove(dirty && !done, ({ repeat }) => setLeave(() => repeat));

  useEffect(() => {
    if (!done) return;
    announce(journalStrings.announce);
    // Pushed from the guide or Detail: go back to that screen. A deep link has no history to return to.
    if (from && router.canGoBack()) router.back();
    else router.replace(from === "archive" ? `/archive/${code}` : `/e/${code}`);
  }, [done, from, code, router]);

  const [audioType, setAudioType] =
    useState<ReturnType<typeof displayMode>>(null);
  const { revision = null } = journal.data ?? {};
  const error = save.error instanceof TRPCClientError ? save.error : null;
  const appCode = error?.data?.appCode;
  const isNetworkError = !!error && !error.data;

  // After login the guest's pending JOURNAL_SAVE saves the guest draft (SPEC §2.2 Sign in 8).
  const consent = useQuery(
    trpc.consent.get.queryOptions(undefined, { enabled: !!me }),
  );
  const ran = useRef(false);
  const ready =
    !!me &&
    !!consent.data &&
    !journal.isPending &&
    drafts.restored !== undefined;
  useEffect(() => {
    if (!ready || ran.current) return;
    ran.current = true;
    void (async () => {
      const action = await takePendingAction({
        kind: "JOURNAL_SAVE",
        exhibitionCode: code,
      });
      const text =
        action && action !== "expired" ? await takeGuestDraft(code) : null;
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
      return router.push({
        pathname: "/login",
        params: {
          returnTo: from
            ? `/e/${code}/journal?from=${from}`
            : `/e/${code}/journal`,
        },
      });
    }
    save.mutate({ code, content, audioType, revision });
  };

  return (
    <Screen tabs>
      <Text variant="headline">{journalStrings.headline}</Text>
      {exhibition.data && (
        <Text variant="eyebrow">{exhibition.data.title}</Text>
      )}
      <Rule tight />
      <Text variant="lede">{journalStrings.subhead}</Text>
      {!journal.isPending && drafts.restored !== undefined && (
        <TextField
          multiline
          size="page"
          label={journalStrings.label}
          placeholder={journalStrings.placeholder}
          value={content}
          onChangeText={(text) => {
            setDraft(text);
            drafts.save(text);
          }}
        />
      )}
      {appCode === "JOURNAL_INVALID" && (
        <Notice error message={journalStrings.invalid} />
      )}
      {isNetworkError && (
        <Notice
          error
          message={journalStrings.network}
          action={{ label: journalStrings.retry, onPress: submit }}
        />
      )}
      {appCode === "REVISION_MISMATCH" && (
        <Notice message={journalStrings.conflict} />
      )}
      <Button
        label={save.isPending ? journalStrings.saving : journalStrings.save}
        disabled={save.isPending}
        onPress={submit}
      />
      {exhibition.data && (
        <AudioArea
          code={code}
          audio={exhibition.data.audio}
          screen="journal"
          onModeChange={setAudioType}
        />
      )}
      {!me && <Text variant="secondary">{journalStrings.guestCaption}</Text>}
      <Dialog
        visible={!!leave}
        onClose={() => setLeave(null)}
        label={journalStrings.leaveLabel}
        body={journalStrings.leaveBody}
      >
        <Button label={journalStrings.stay} onPress={() => setLeave(null)} />
        <Button
          label={journalStrings.leave}
          variant="secondary"
          onPress={() => leave?.()}
        />
      </Dialog>
    </Screen>
  );
}
