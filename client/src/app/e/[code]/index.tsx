import { useQuery, useQueries } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { useArchiveVisit } from "../../../features/archive/useArchiveVisit";
import { PendingActionRunner } from "../../../features/auth/PendingActionRunner";
import { GuidePlaylist } from "../../../features/audio/GuidePlaylist";
import { useMe } from "../../../features/auth/use-me";
import { KeepsakePresence } from "../../../features/keepsake/KeepsakePresence";
import { GuideHeader } from "../../../features/guide/GuideHeader";
import { guideStrings } from "../../../features/guide/strings";
import { useSavedLabel } from "../../../features/journal/saved-label";
import { SentenceAction } from "../../../features/scrap/SentenceAction";
import { track } from "../../../lib/analytics";
import { STALE_TIME, useTRPC } from "../../../lib/trpc";
import { Button } from "../../../ui/Button";
import { DocumentView } from "../../../ui/DocumentView";
import { Notice } from "../../../ui/Notice";
import { Rule } from "../../../ui/Rule";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import { spacing } from "../../../ui/theme";
import { View } from "react-native";
import { TextAction } from "../../../ui/TextAction";

// Exhibition Guide 04 (SPEC §3).
export default function ExhibitionGuide() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const trpc = useTRPC();
  const [exhibition, guide] = useQueries({
    queries: [
      { ...trpc.exhibition.get.queryOptions({ code }), staleTime: STALE_TIME.public },
      { ...trpc.guide.get.queryOptions({ code }), staleTime: STALE_TIME.public },
    ],
  });

  useArchiveVisit(code, !!exhibition.data);
  const loaded = !!exhibition.data;
  useEffect(() => {
    if (loaded) track("exhibition_view", { exhibition_code: code });
  }, [loaded, code]);

  if (exhibition.data && guide.data) {
    return (
      <Screen tabs>
        <PendingActionRunner code={code} />
        <GuideHeader {...exhibition.data} />
        <GuidePlaylist code={code} audio={exhibition.data.audio} />
        <KeepsakePresence code={code} exhibition={exhibition.data} hasGuide={guide.data.document !== null} />
        <DocumentView document={exhibition.data.description} />
        {guide.data.document && (
          <>
            <Rule />
            <DocumentView document={guide.data.document} renderSentence={(b, quote) => <SentenceAction code={code} sentence={b} quote={quote} />} />
          </>
        )}
        <Rule />
        <JournalLink code={code} />
      </Screen>
    );
  }
  const error = exhibition.error ?? guide.error;
  if (!error) return <Screen tabs>{null}</Screen>;

  const notFound = error instanceof TRPCClientError && error.data?.code === "NOT_FOUND";
  if (!notFound) {
    return (
      <Screen tabs>
        <Notice message={guideStrings.loadFailed} error />
        <TextAction label={guideStrings.retry} onPress={() => void Promise.all([exhibition.refetch(), guide.refetch()])} />
      </Screen>
    );
  }
  return (
    <Screen tabs>
      <Text variant="headline">{guideStrings.unavailableTitle}</Text>
      <Text variant="secondary">{guideStrings.unavailable}</Text>
      <Button label={guideStrings.scan} href="/scan" />
      <TextAction label={guideStrings.backHome} trailing="→" href="/" />
    </Screen>
  );
}

// The last block: the way to the journal, centred in the column.
function JournalLink({ code }: { code: string }) {
  const trpc = useTRPC();
  const me = useMe();
  const { data: journal } = useQuery(trpc.journal.get.queryOptions({ code }, { enabled: !!me }));
  const savedLabel = useSavedLabel(code);
  return (
    <View style={{ alignItems: "center", gap: spacing.tight, paddingVertical: spacing.section / 2 }}>
      <TextAction label={journal ? guideStrings.yourJournal : guideStrings.writeJournal} trailing="→" variant="subhead" href={`/e/${code}/journal?from=guide`} />
      {savedLabel && <Text variant="secondary">{savedLabel}</Text>}
    </View>
  );
}
