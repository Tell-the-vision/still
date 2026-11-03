import { useQuery } from "@tanstack/react-query";
import type { AppRouter } from "@still/shared/router";
import type { inferRouterOutputs } from "@trpc/server";
import { year } from "../../lib/dates";
import { useTRPC } from "../../lib/trpc";
import { KeepsakeMini, useFitScale } from "../../ui/KeepsakeThumb";
import { Text } from "../../ui/Text";
import { Tile } from "../../ui/Tile";
import { View } from "react-native";

type Archive = inferRouterOutputs<AppRouter>["archive"]["list"]["items"][number];

// One grid cell of My Archive (SPEC §8.4): the keepsake card in miniature, title and "CITY · year".
// The list has no kept lines, so only archives that saved a card fetch it; the rest show the cover-and-title card.
export function ArchiveCard({ archive }: { archive: Archive }) {
  const { code, title, venue, startDate, coverImage } = archive.exhibition;
  const trpc = useTRPC();
  const { data: saved } = useQuery(trpc.keepsake.get.queryOptions({ code }, { enabled: archive.hasKeepsake }));
  const { onLayout, scale } = useFitScale();
  const card = saved?.card ?? { exhibition: archive.exhibition, image: coverImage, sentences: [], journalExcerpt: null };
  return (
    <Tile href={`/archive/${code}`} label={title}>
      <View onLayout={onLayout} style={{ width: "100%" }}>
        <KeepsakeMini scale={scale} card={card} templateId={saved?.templateId ?? "cover"} />
      </View>
      <Text variant="row">{title}</Text>
      <Text variant="caption">{`${venue.city} · ${year(startDate)}`}</Text>
    </Tile>
  );
}
