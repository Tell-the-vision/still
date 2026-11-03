import { useQuery } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { useLocalSearchParams } from "expo-router";
import { DeleteArchive } from "../../../features/archive/DeleteArchive";
import { archiveStrings } from "../../../features/archive/strings";
import { useRequireLogin } from "../../../features/auth/require-login";
import { ScrapSection } from "../../../features/scrap/ScrapSection";
import { JournalSection } from "../../../features/journal/JournalSection";
import { KeepsakeSection } from "../../../features/keepsake/KeepsakeSection";
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
  const { code } = useLocalSearchParams<{ code: string }>();
  const me = useRequireLogin(`/archive/${code}`);
  const trpc = useTRPC();
  const { data: archive, error, refetch } = useQuery(trpc.archive.get.queryOptions({ code }, { enabled: Boolean(me) }));
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
          <KeepsakeHero code={code} exhibition={archive.exhibition} />
          <Rule />
          <Stack gap="section">
            <KeepsakeSection code={code} exhibition={archive.exhibition} />
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
