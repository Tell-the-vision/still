import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../../lib/trpc";
import { Button } from "../../ui/Button";
import { Section } from "../../ui/Section";
import { Text } from "../../ui/Text";
import { homeStrings } from "./strings";

// Home 02: the most recently visited exhibition, plus the archive size. Nothing for an empty archive.
export function CurrentExhibition() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.archive.list.queryOptions({ limit: 1 }));
  const current = data?.items[0];
  if (!data || !current) return null;
  const { code, title } = current.exhibition;
  return (
    <>
      <Section label={homeStrings.current}>
        <Text>{title}</Text>
        <Button label={homeStrings.openGuide} href={`/e/${code}`} />
      </Section>
      <Section label={homeStrings.archive}>
        <Text>{homeStrings.saved(data.totalSize)}</Text>
        <Button label={homeStrings.viewAll} trailing="→" variant="secondary" href="/archive" />
      </Section>
    </>
  );
}
