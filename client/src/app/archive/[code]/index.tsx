import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { DeleteArchive } from "../../../features/archive/DeleteArchive";
import { archiveStrings } from "../../../features/archive/strings";
import { useRequireLogin } from "../../../features/auth/require-login";
import { ScrapSection } from "../../../features/scrap/ScrapSection";
import { GuideHeader } from "../../../features/guide/GuideHeader";
import { JournalSection } from "../../../features/journal/JournalSection";
import { useTRPC } from "../../../lib/trpc";
import { Button } from "../../../ui/Button";
import { Notice } from "../../../ui/Notice";
import { Screen } from "../../../ui/Screen";
import { Stack } from "../../../ui/Stack";
import { Text } from "../../../ui/Text";

// Archive Detail 08: the exhibition header plus one section per kind of personal record.
export default function ArchiveDetail() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const me = useRequireLogin(`/archive/${code}`);
  const trpc = useTRPC();
  const { data: archive } = useQuery(trpc.archive.get.queryOptions({ code }, { enabled: Boolean(me) }));
  return (
    <Screen tabs headerRight>
      {archive === null && (
        <Stack>
          <Notice message={archiveStrings.missing} />
          <Button label={archiveStrings.heading} href="/archive" />
        </Stack>
      )}
      {archive && (
        <Stack>
          <GuideHeader {...archive.exhibition} />
          <Text variant="secondary">{archiveStrings.lastVisited(archive.lastVisitedAt)}</Text>
          <ScrapSection code={code} />
          <JournalSection code={code} />
          {/* K1a KeepsakeSection */}
          {/* R3 DeleteArchive */}
          <DeleteArchive code={code} />
        </Stack>
      )}
    </Screen>
  );
}
