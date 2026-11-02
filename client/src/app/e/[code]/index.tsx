import { useQueries } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { useLocalSearchParams } from "expo-router";
import { GuideHeader } from "../../../features/guide/GuideHeader";
import { guideStrings } from "../../../features/guide/strings";
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

  if (exhibition.data && guide.data) {
    return (
      <Screen tabs>
        <GuideHeader {...exhibition.data} />
        <DocumentView document={exhibition.data.description} />
        <DocumentView document={guide.data.document} />
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
