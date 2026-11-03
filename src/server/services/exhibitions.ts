import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { storedDocument } from "../../../shared/src/document";
import { db } from "../db/client";
import { exhibitions } from "../db/schema";
import { publicImageUrl } from "../media/public-url";
import { expandDocument } from "./documents";

export async function getPublishedExhibition(code: string) {
  const row = await db.query.exhibitions.findFirst({
    where: and(eq(exhibitions.code, code), eq(exhibitions.status, "PUBLISHED")),
    with: { venue: true, playlist: true, coverImage: true, images: true },
  });
  if (!row) throw new TRPCError({ code: "NOT_FOUND" });
  return row;
}

type ExhibitionRow = Awaited<ReturnType<typeof getPublishedExhibition>>;

// The SPEC §3.3 representation.
export function toExhibition(row: ExhibitionRow) {
  const { coverImage, playlist } = row;
  const description = storedDocument.nullable().parse(row.description);
  return {
    code: row.code,
    title: row.title,
    description: expandDocument(description, { images: row.images }),
    venue: { name: row.venue.name, city: row.venue.city },
    startDate: row.startDate,
    endDate: row.endDate,
    coverImage: coverImage && {
      id: coverImage.id,
      url: publicImageUrl(coverImage.objectKey),
      altText: coverImage.altText,
      width: coverImage.width,
      height: coverImage.height,
    },
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
