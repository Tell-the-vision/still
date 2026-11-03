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
import { Rule } from "../../../ui/Rule";
import { Screen } from "../../../ui/Screen";
import { Section } from "../../../ui/Section";
import { Text } from "../../../ui/Text";
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
        <Text variant="subhead">{guideStrings.about}</Text>
        <DocumentView document={exhibition.data.description} />
        <AudioArea code={code} audio={exhibition.data.audio} screen="guide" />
        <Rule />
        <Section label={guideStrings.commentary}>
          <DocumentView document={guide.data.document} renderSentence={(b) => <SentenceAction code={code} sentence={b} />} />
        </Section>
        <Rule />
        <TextAction label={guideStrings.writeJournal} trailing="→" variant="subhead" href={`/e/${code}/journal`} />
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
