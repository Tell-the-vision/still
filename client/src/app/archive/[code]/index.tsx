import { useQuery } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { DeleteArchive } from "../../../features/archive/DeleteArchive";
import { archiveStrings } from "../../../features/archive/strings";
import { useRequireLogin } from "../../../features/auth/require-login";
import { ScrapSection } from "../../../features/scrap/ScrapSection";
import { JournalSection } from "../../../features/journal/JournalSection";
import { announce } from "../../../features/journal/announce";
import { journalStrings } from "../../../features/journal/strings";
import { KeepsakeSection } from "../../../features/keepsake/KeepsakeSection";
import { useDevelop } from "../../../features/keepsake/develop";
import { keepsakeQueryOptions } from "../../../features/keepsake/keepsakeQuery";
import { longDate, year } from "../../../lib/dates";
import { useTRPC } from "../../../lib/trpc";
import { KeepsakeHero } from "../../../features/keepsake/KeepsakeHero";
import { Button } from "../../../ui/Button";
import { Rule } from "../../../ui/Rule";
import { Screen } from "../../../ui/Screen";
import { Stack } from "../../../ui/Stack";
import { Text } from "../../../ui/Text";
import { TextAction } from "../../../ui/TextAction";

const BackLink = () => <TextAction label={archiveStrings.backLabel} accessibilityLabel={archiveStrings.backName} variant="secondary" leading="←" href="/archive" />;

// Archive Detail 08: the exhibition summary, then one section per kind of personal record.
export default function ArchiveDetail() {
  const { code, saved } = useLocalSearchParams<{ code: string; saved?: string }>();
  const router = useRouter();
  const me = useRequireLogin(`/archive/${code}`);
  // Arriving from a journal save: announce once here, then clear the one-shot param.
  useEffect(() => {
    if (!saved) return;
    announce(journalStrings.announce);
    router.setParams({ saved: undefined });
  }, [saved, router]);
  const trpc = useTRPC();
  const { data: archive, error, refetch } = useQuery(trpc.archive.get.queryOptions({ code }, { enabled: Boolean(me) }));
  // A save from here lands on the hero: it develops once, and the status settles with it.
  const { data: keepsake } = useQuery(keepsakeQueryOptions(trpc, code, Boolean(me)));
  const develop = useDevelop(code, keepsake?.updatedAt, "archive");
  const missing = archive === null || (error instanceof TRPCClientError && error.data?.code === "NOT_FOUND");
  return (
    <Screen tabs>
      {(missing || error) && (
        <Stack>
          <BackLink />
          <Text variant="headline">{archiveStrings.missingTitle}</Text>
          <Text variant="secondary">{missing ? archiveStrings.missing : archiveStrings.loadFailed}</Text>
          {missing ? <Button label={archiveStrings.heading} href="/archive" /> : <Button label={archiveStrings.tryAgain} onPress={() => refetch()} />}
        </Stack>
      )}
      {archive && (
        <Stack>
          <BackLink />
          <Text variant="headline">{archive.exhibition.title}</Text>
          <Text variant="caption">{`${archive.exhibition.venue.name.toUpperCase()} · ${year(archive.exhibition.startDate)}`}</Text>
          <KeepsakeHero code={code} exhibition={archive.exhibition} develop={develop} />
          <Rule />
          <Stack gap="section">
            <KeepsakeSection code={code} exhibition={archive.exhibition} statusDevelop={develop} />
            <ScrapSection code={code} />
            <JournalSection code={code} />
          </Stack>
          <Rule />
          <Text variant="action">{archiveStrings.lastVisited(longDate(archive.lastVisitedAt))}</Text>
          <Text variant="label">{archiveStrings.actions}</Text>
          <DeleteArchive code={code} title={archive.exhibition.title} />
        </Stack>
      )}
    </Screen>
  );
}
