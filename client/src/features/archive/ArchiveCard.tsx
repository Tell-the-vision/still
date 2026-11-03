import type { AppRouter } from "@still/shared/router";
import type { inferRouterOutputs } from "@trpc/server";
import { year } from "../../lib/dates";
import { Artwork } from "../../ui/Artwork";
import { Frame } from "../../ui/Frame";
import { Text } from "../../ui/Text";
import { Tile } from "../../ui/Tile";

type Archive = inferRouterOutputs<AppRouter>["archive"]["list"]["items"][number];

// One grid cell of My Archive (SPEC §8.4): cover, title and "CITY · year".
export function ArchiveCard({ archive }: { archive: Archive }) {
  const { code, title, venue, startDate, coverImage } = archive.exhibition;
  return (
    <Tile href={`/archive/${code}`} label={title}>
      {coverImage ? <Artwork url={coverImage.url} altText={null} width={147} height={150} /> : <Frame aspectRatio={147 / 150} />}
      <Text variant="row">{title}</Text>
      <Text variant="caption">{`${venue.city} · ${year(startDate)}`}</Text>
    </Tile>
  );
}
