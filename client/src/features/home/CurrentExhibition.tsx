import { useQuery } from "@tanstack/react-query";
import { shortRange } from "../../lib/dates";
import { useTRPC } from "../../lib/trpc";
import { Artwork } from "../../ui/Artwork";
import { Button } from "../../ui/Button";
import { Rule } from "../../ui/Rule";
import { Section } from "../../ui/Section";
import { Stack } from "../../ui/Stack";
import { Text } from "../../ui/Text";
import { TextAction } from "../../ui/TextAction";
import { homeStrings } from "./strings";

// Home 02: the most recently visited exhibition, plus the archive size. Nothing for an empty archive.
export function CurrentExhibition() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.archive.list.queryOptions({ limit: 1 }));
  const current = data?.items[0];
  if (!data || !current) return null;
  const { code, title, venue, startDate, endDate, coverImage } = current.exhibition;
  return (
    <>
      <Section label={homeStrings.continueExploring}>
        <Stack gap="inset">
          {coverImage && <Artwork {...coverImage} caption={homeStrings.current} />}
          <Text variant="title">{title}</Text>
          <Text variant="secondary">{`${venue.name} · ${shortRange(startDate, endDate)}`}</Text>
          <Button label={homeStrings.openGuide} href={`/e/${code}`} />
        </Stack>
      </Section>
      <Rule />
      <Section label={homeStrings.archive}>
        <Stack direction="row" align="center" gap="inset">
          <Text variant="numeral">{String(data.totalSize).padStart(2, "0")}</Text>
          <Text variant="secondary">{homeStrings.saved(data.totalSize)}</Text>
          <TextAction label={homeStrings.viewAll} trailing="→" variant="secondary" tone="primary" href="/archive" />
        </Stack>
      </Section>
    </>
  );
}
