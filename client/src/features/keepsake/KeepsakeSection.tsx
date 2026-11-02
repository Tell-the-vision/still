import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../../lib/trpc";
import { Button } from "../../ui/Button";
import { KeepsakeCard } from "../../ui/KeepsakeCard";
import { Section } from "../../ui/Section";
import { Stack } from "../../ui/Stack";
import { Text } from "../../ui/Text";
import { keepsakeStrings } from "./strings";

// The web card on Archive Detail: the saved card, or an empty note, plus the way to the creator.
export function KeepsakeSection({ code }: { code: string }) {
  const trpc = useTRPC();
  const { data: keepsake } = useQuery(trpc.keepsake.get.queryOptions({ code }));
  const href = `/archive/${code}/keepsake` as const;
  if (keepsake === undefined) return null;
  if (keepsake === null) {
    return (
      <Section label={keepsakeStrings.none}>
        <Stack>
          <Text variant="secondary">{keepsakeStrings.empty}</Text>
          <Button label={keepsakeStrings.create} trailing="→" href={href} />
        </Stack>
      </Section>
    );
  }
  return (
    <Section label={keepsakeStrings.present}>
      <Stack>
        <KeepsakeCard card={keepsake.card} templateId={keepsake.templateId} />
        <Button label={keepsakeStrings.edit} trailing="→" href={href} />
      </Stack>
    </Section>
  );
}
