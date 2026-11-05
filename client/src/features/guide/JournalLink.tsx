import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";
import { useTRPC } from "../../lib/trpc";
import { TextAction } from "../../ui/TextAction";
import { spacing } from "../../ui/theme";
import { useMe } from "../auth/use-me";
import { guideStrings } from "./strings";

// The last block: the way to the journal, centred in the column.
export function JournalLink({ code }: { code: string }) {
  const trpc = useTRPC();
  const me = useMe();
  const { data: journal } = useQuery(trpc.journal.get.queryOptions({ code }, { enabled: !!me }));
  return (
    <View style={{ alignItems: "center", gap: spacing.tight, }}>
      <TextAction label={journal ? guideStrings.yourJournal : guideStrings.writeJournal} trailing="→" variant="subhead" href={`/e/${code}/journal?from=guide`} />
    </View>
  );
}
