import { useQuery } from "@tanstack/react-query";
import type { AppRouter } from "@still/shared/router";
import type { inferRouterOutputs } from "@trpc/server";
import { useTRPC } from "../../lib/trpc";
import { KeepsakeMini, useFitScale } from "../../ui/KeepsakeThumb";
import { Tile } from "../../ui/Tile";
import { View } from "react-native";

type Archive = inferRouterOutputs<AppRouter>["archive"]["list"]["items"][number];

// One grid cell of My Archive (SPEC §8.4): the keepsake card in miniature. The card already shows the
// title and "CITY / year" and draws its own frame, so the tile adds neither.
// The list has no kept lines, so only archives with a saved card fetch their cards (one per artwork) and show the latest;
// the rest show the cover-and-title card.
export function ArchiveCard({ archive }: { archive: Archive }) {
  const { code, title, coverImage } = archive.exhibition;
  const trpc = useTRPC();
  const { data: cards } = useQuery(trpc.keepsake.list.queryOptions({ code }, { enabled: archive.hasKeepsake }));
  const saved = cards?.[0];
  const { onLayout, scale } = useFitScale();
  const card = saved?.card ?? { exhibition: archive.exhibition, image: coverImage, sentences: [], journalExcerpt: null };
  return (
    <Tile href={`/archive/${code}`} label={title} framed={false}>
      <View onLayout={onLayout} style={{ width: "100%" }}>
        <KeepsakeMini scale={scale} card={card} templateId={saved?.templateId ?? "cover"} />
      </View>
    </Tile>
  );
}
