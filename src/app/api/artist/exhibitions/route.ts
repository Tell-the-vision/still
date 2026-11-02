import { handler, ok, readJson, requireArtist } from "@/lib/api";
import { createExhibition, type ExhibitionInput } from "@/lib/artist";
import { listExhibitionsByOwner } from "@/lib/exhibitions";

/** GET /api/artist/exhibitions — exhibitions I own (artist / admin). */
export const GET = handler(async () => {
  const user = await requireArtist();
  const rows = await listExhibitionsByOwner(user.id);
  return ok({
    exhibitions: rows
      .filter((r) => r.status !== "DELETED")
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        subtitle: r.subtitle,
        venue: r.venue,
        startDate: r.startDate,
        endDate: r.endDate,
        coverImageUrl: r.coverImageUrl,
        status: r.status,
        publishedAt: r.publishedAt,
        updatedAt: r.updatedAt,
        likeCount: r.likes.length,
        openReportCount: r.reports.filter((x) => x.status === "OPEN").length,
        archiveCount: r.archives.length,
      })),
  });
});

/**
 * POST /api/artist/exhibitions  { title, subtitle?, venue?, startDate?, endDate?,
 *   description?, coverImageUrl?, guide?: [{section, sentences[]}], audio?: {...} }
 * Creates a DRAFT exhibition owned by the caller. Publish with POST …/{id}/status.
 */
export const POST = handler(async (req) => {
  const user = await requireArtist();
  const body = await readJson<ExhibitionInput>(req);
  const row = await createExhibition(user, body);
  return ok({ exhibition: row }, 201);
});
