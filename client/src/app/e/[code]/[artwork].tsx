import { useQueries } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { useArchiveVisit } from "../../../features/archive/useArchiveVisit";
import { PendingActionRunner } from "../../../features/auth/PendingActionRunner";
import { GuidePage } from "../../../features/guide/GuidePage";
import { pageOf } from "../../../features/guide/pages";
import { guideStrings } from "../../../features/guide/strings";
import { SentenceAction } from "../../../features/scrap/SentenceAction";
import { track } from "../../../lib/analytics";
import { STALE_TIME, useTRPC } from "../../../lib/trpc";
import { Button } from "../../../ui/Button";
import { Notice } from "../../../ui/Notice";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import { TextAction } from "../../../ui/TextAction";

// One page of a guide on its own (an artwork, an artist…): /e/{code}/{page} is the address in the QR posted beside
// the work, {page} being the first 8 characters of its content id.
export default function GuidePageScreen() {
  const { code, artwork } = useLocalSearchParams<{ code: string; artwork: string }>();
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

  const page = guide.data ? pageOf(guide.data.document, artwork) : null;
  if (exhibition.data && guide.data && page) {
    return (
      <Screen tabs>
        <PendingActionRunner code={code} />
        <GuidePage code={code} page={artwork} exhibition={exhibition.data} document={page} renderSentence={(b, quote) => <SentenceAction code={code} sentence={b} quote={quote} />} />
      </Screen>
    );
  }
  const error = exhibition.error ?? guide.error;
  if (!error && !(exhibition.data && guide.data)) return <Screen tabs>{null}</Screen>;

  const notFound = !error || (error instanceof TRPCClientError && error.data?.code === "NOT_FOUND");
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
