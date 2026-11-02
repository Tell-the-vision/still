import { apiError, handler, ok, type Params } from "@/lib/api";
import { findExhibition, getAudioConfig } from "@/lib/exhibitions";

/**
 * GET /api/exhibitions/{id|slug}/audio — audio configuration (public).
 * `mode` already applies the priority logic (spec §6.3):
 *   EXTERNAL_PLAYLIST when the organiser provided one, else AMBIENCE.
 */
export const GET = handler(async (_req, { params }: Params<{ id: string }>) => {
  const { id } = await params;
  const exhibition = await findExhibition(id);
  if (!exhibition) return apiError("RESOURCE_NOT_FOUND", "전시를 찾을 수 없습니다.");
  const config = await getAudioConfig(exhibition.id);
  const hasPlaylist = Boolean(config && config.audioProvider !== "NONE" && config.playlistUrl);
  return ok({
    exhibitionId: exhibition.id,
    mode: hasPlaylist ? "EXTERNAL_PLAYLIST" : "AMBIENCE",
    externalPlaylist: hasPlaylist
      ? {
          provider: config!.audioProvider,
          url: config!.playlistUrl,
          title: config!.playlistTitle,
          description: config!.playlistDescription,
        }
      : null,
    ambience: {
      enabled: config?.ambienceEnabled ?? true,
      type: config?.ambienceType ?? "PINK_NOISE",
    },
  });
});
