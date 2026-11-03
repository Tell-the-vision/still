import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTRPC } from "../../lib/trpc";
import { Notice } from "../../ui/Notice";
import { Section } from "../../ui/Section";
import { Stack } from "../../ui/Stack";
import { Text } from "../../ui/Text";
import { spacing } from "../../ui/theme";
import { KeepMark } from "./KeepMark";
import { scrapStrings } from "./strings";
import { useKeepToggle } from "./useKeepToggle";

type Line = { sentenceId: string; content: string };

// One kept line with its mark. Unkeeping leaves the row in place showing "+", which keeps it again.
function KeptLine({ code, line, kept }: { code: string; line: Line; kept: boolean }) {
  const toggle = useKeepToggle(code, line.sentenceId, line.content);
  return (
    <Stack gap="inset">
      <View style={styles.row}>
        <View style={styles.quote}>
          <Text variant="quote">{line.content}</Text>
        </View>
        <KeepMark kept={kept} pending={toggle.pending} onPress={kept ? toggle.unkeep : toggle.keep} />
      </View>
      {toggle.unkeepFailed && kept && <Notice message={scrapStrings.removeFailed} error action={{ label: scrapStrings.retry, onPress: toggle.unkeep }} />}
      {toggle.keepFailed && !kept && <Notice message={scrapStrings.saveFailed} error action={{ label: scrapStrings.retry, onPress: toggle.keep }} />}
    </Stack>
  );
}

// Archive Detail: the lines kept from this exhibition (SPEC §4.2). Lines unkept here stay listed until the screen is left.
export function ScrapSection({ code }: { code: string }) {
  const trpc = useTRPC();
  const { data: scraps = [] } = useQuery(trpc.scrap.list.queryOptions({ code }));
  const seen = useShownLines(scraps);
  const keptIds = new Set(scraps.map((scrap) => scrap.sentenceId));
  return (
    <Section labelVariant="row" label={scrapStrings.keptHeading()}>
      <Stack>
        {seen.map((line) => (
          <KeptLine key={line.sentenceId} code={code} line={line} kept={keptIds.has(line.sentenceId)} />
        ))}
      </Stack>
    </Section>
  );
}

// Every line seen while this screen is mounted, in first-seen order.
function useShownLines(scraps: Line[]) {
  const [shown] = useState(() => new Map<string, Line>());
  for (const scrap of scraps) if (!shown.has(scrap.sentenceId)) shown.set(scrap.sentenceId, scrap);
  return [...shown.values()];
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.tight },
  quote: { flex: 1 },
});
