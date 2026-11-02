import { useQueries } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { useArchiveVisit } from "../../../features/archive/useArchiveVisit";
import { PendingActionRunner } from "../../../features/auth/PendingActionRunner";
import { AudioArea } from "../../../features/audio/AudioArea";
import { GuideHeader } from "../../../features/guide/GuideHeader";
import { guideStrings } from "../../../features/guide/strings";
import { SentenceAction } from "../../../features/scrap/SentenceAction";
import { track } from "../../../lib/analytics";
import { STALE_TIME, useTRPC } from "../../../lib/trpc";
import { Button } from "../../../ui/Button";
import { DocumentView } from "../../../ui/DocumentView";
import { Notice } from "../../../ui/Notice";
import { Screen } from "../../../ui/Screen";

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
        <AudioArea audio={exhibition.data.audio} screen="guide" />
        <DocumentView document={exhibition.data.description} />
        <DocumentView document={guide.data.document} renderSentence={(b) => <SentenceAction code={code} sentence={b} />} />
        <Button label={guideStrings.writeJournal} trailing="→" variant="secondary" href={`/e/${code}/journal`} />
      </Screen>
    );
  }
  const error = exhibition.error ?? guide.error;
  if (!error) return <Screen tabs>{null}</Screen>;

  const notFound = error instanceof TRPCClientError && error.data?.code === "NOT_FOUND";
  return (
    <Screen tabs>
      <Notice message={notFound ? guideStrings.unavailable : guideStrings.loadFailed} error />
      {!notFound && (
        <Button label={guideStrings.retry} onPress={() => void Promise.all([exhibition.refetch(), guide.refetch()])} />
      )}
    </Screen>
  );
}
