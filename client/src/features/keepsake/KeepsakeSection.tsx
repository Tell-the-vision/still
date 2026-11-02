import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../../lib/trpc";
import { Section } from "../../ui/Section";
import { Text } from "../../ui/Text";
import { keepsakeStrings } from "./strings";

// The web card on Archive Detail: its saved sentences, or an empty note.
export function KeepsakeSection({ code }: { code: string }) {
  const trpc = useTRPC();
  const { data: keepsake } = useQuery(trpc.keepsake.get.queryOptions({ code }));
  if (keepsake === undefined) return null;
  if (keepsake === null) {
    return (
      <Section label={keepsakeStrings.none}>
        <Text variant="secondary">{keepsakeStrings.empty}</Text>
      </Section>
    );
  }
  return (
    <Section label={keepsakeStrings.present}>
      {keepsake.card.sentences.map((sentence) => (
        <Text key={sentence.sentenceId}>{sentence.content}</Text>
      ))}
    </Section>
  );
}
