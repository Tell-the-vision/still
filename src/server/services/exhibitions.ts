import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { blockText, stillDocument, type StillDocument } from "../../../shared/src/still-doc";
import { db } from "../db/client";
import { exhibitions } from "../db/schema";
import { publicImageUrl } from "../media/public-url";
import { expandDocument } from "./documents";
import { completeExhibition, hasPublicCopy } from "./visible";

export async function getPublishedExhibition(code: string) {
  const row = await db.query.exhibitions.findFirst({
    where: and(eq(exhibitions.code, code), eq(exhibitions.state, "PUBLISHED")),
    with: { venue: true, playlist: true, coverImage: true, images: true },
  });
  if (!row) throw new TRPCError({ code: "NOT_FOUND" });
  return completeExhibition(row);
}

type ExhibitionRow = Awaited<ReturnType<typeof getPublishedExhibition>>;

// The SPEC §3.3 representation.
export function toExhibition(row: ExhibitionRow) {
  const { coverImage, playlist } = row;
  const description = stillDocument.nullable().parse(row.description);
  return {
    code: row.code,
    title: row.title,
    description: expandDocument(description, { images: row.images }),
    venue: { name: row.venue.name, city: row.venue.city },
    startDate: row.startDate,
    endDate: row.endDate,
    coverImage: hasPublicCopy(coverImage) ? {
      id: coverImage.id,
      url: publicImageUrl(coverImage.objectKey),
      altText: coverImage.altText,
      width: coverImage.width,
      height: coverImage.height,
    } : null,
    audio: {
      playlist: playlist && {
        provider: playlist.provider,
        url: playlist.url,
        title: playlist.title,
        description: playlist.description,
      },
      ambienceEnabled: row.ambienceEnabled,
    },
  };
}

export type ExhibitionScope = "ON_VIEW" | "ALL";

// Exhibition dates are calendar dates in Korea, so "today" is the Asia/Seoul date (en-CA formats as YYYY-MM-DD).
const seoulToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

export async function listPublishedExhibitions(scope: ExhibitionScope) {
  const today = seoulToday();
  const rows = await db.query.exhibitions.findMany({
    where: and(
      eq(exhibitions.state, "PUBLISHED"),
      scope === "ON_VIEW" ? and(lte(exhibitions.startDate, today), gte(exhibitions.endDate, today)) : undefined,
    ),
    with: { venue: true, coverImage: true },
    orderBy: [desc(exhibitions.startDate), exhibitions.title],
  });
  return {
    items: rows.map(completeExhibition).map((row) => ({
      code: row.code,
      title: row.title,
      venue: { name: row.venue.name, city: row.venue.city },
      startDate: row.startDate,
      endDate: row.endDate,
      coverImage: hasPublicCopy(row.coverImage) ? {
        url: publicImageUrl(row.coverImage.objectKey),
        altText: row.coverImage.altText,
        width: row.coverImage.width,
        height: row.coverImage.height,
      } : null,
      availability: row.startDate > today ? ("UPCOMING" as const) : row.endDate < today ? ("ENDED" as const) : ("ON_VIEW" as const),
    })),
  };
}

// Home's feed, one tile per artwork (each has its own page, /e/{code}/{page}): every page of the published guides,
// the newest exhibitions first and pages in guide order, each with its title, first picture, and where and when.
// A page's blocks are those whose ids start with its first 8 characters (the publish compile); section titles
// ("sec-…") belong to no page.
export async function listPublishedPages(scope: ExhibitionScope) {
  const today = seoulToday();
  const rows = await db.query.exhibitions.findMany({
    where: and(
      eq(exhibitions.state, "PUBLISHED"),
      scope === "ON_VIEW" ? and(lte(exhibitions.startDate, today), gte(exhibitions.endDate, today)) : undefined,
    ),
    with: { venue: true, images: true },
    orderBy: [desc(exhibitions.startDate), exhibitions.title],
  });
  const items = rows.map(completeExhibition).flatMap((row) => {
    const pages = new Map<string, StillDocument["content"]>();
    for (const block of stillDocument.safeParse(row.guide).data?.content ?? []) {
      const page = /^([0-9a-f]{8})-/.exec(block.attrs.id)?.[1];
      if (page) pages.set(page, [...(pages.get(page) ?? []), block]);
    }
    const availability = row.startDate > today ? ("UPCOMING" as const) : row.endDate < today ? ("ENDED" as const) : ("ON_VIEW" as const);
    return [...pages].map(([page, blocks]) => {
      const heading = blocks.find((block) => block.type === "heading");
      const picture = blocks.find((block) => block.type === "stillImage");
      const image = picture?.type === "stillImage" ? row.images.find((i) => i.id === picture.attrs.imageId) : undefined;
      return {
        code: row.code,
        page,
        title: heading ? blockText(heading) : "",
        image: hasPublicCopy(image) ? { url: publicImageUrl(image.objectKey), altText: image.altText, width: image.width, height: image.height } : null,
        venue: { name: row.venue.name, city: row.venue.city },
        startDate: row.startDate,
        endDate: row.endDate,
        availability,
      };
    });
  });
  return { items };
}
