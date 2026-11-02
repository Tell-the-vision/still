import { handler, noContent, ok, readJson, requireUser, type Params } from "@/lib/api";
import { getManagedExhibition, setExhibitionStatus, updateExhibition, type ExhibitionInput } from "@/lib/artist";
import { getGuide, groupGuide } from "@/lib/exhibitions";
import { themeOf } from "@/lib/keepsake-templates";
import { likeSummary } from "@/lib/moderation";

/** GET /api/artist/exhibitions/{id} — full editable payload (owner or admin). */
export const GET = handler(async (_req, { params }: Params<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await params;
  const ex = await getManagedExhibition(user, id);
  const sentences = await getGuide(ex.id);
  const likes = await likeSummary(ex.id);
  return ok({
    exhibition: {
      id: ex.id,
      slug: ex.slug,
      title: ex.title,
      subtitle: ex.subtitle,
      venue: ex.venue,
      startDate: ex.startDate,
      endDate: ex.endDate,
      description: ex.description,
      coverImageUrl: ex.coverImageUrl,
      status: ex.status,
      publishedAt: ex.publishedAt,
      ownerId: ex.ownerId,
      owner: ex.owner,
      createdAt: ex.createdAt,
      updatedAt: ex.updatedAt,
      likeCount: likes.count,
    },
    theme: themeOf(ex),
    guide: groupGuide(sentences).map((g) => ({ section: g.section, sentences: g.sentences.map((s) => s.content) })),
    audio: ex.audioConfig
      ? {
          provider: ex.audioConfig.audioProvider,
          playlistUrl: ex.audioConfig.playlistUrl,
          playlistTitle: ex.audioConfig.playlistTitle,
          playlistDescription: ex.audioConfig.playlistDescription,
          ambienceEnabled: ex.audioConfig.ambienceEnabled,
        }
      : { provider: "NONE", playlistUrl: null, playlistTitle: null, playlistDescription: null, ambienceEnabled: true },
  });
});

/** PUT /api/artist/exhibitions/{id} — partial update (same body as POST). */
export const PUT = handler(async (req, { params }: Params<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await params;
  const ex = await getManagedExhibition(user, id);
  const body = await readJson<ExhibitionInput>(req);
  const row = await updateExhibition(ex, body);
  return ok({ exhibition: row });
});

/** DELETE /api/artist/exhibitions/{id} — soft delete (visitors' archives keep the info). */
export const DELETE = handler(async (_req, { params }: Params<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await params;
  const ex = await getManagedExhibition(user, id);
  await setExhibitionStatus(ex, "DELETED");
  return noContent();
});
