import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { storedDocument } from "../../../shared/src/document";
import { db } from "../db/client";
import { exhibitions, guideSentences } from "../db/schema";
import { expandDocument } from "./documents";

export async function getGuide(code: string) {
  const row = await db.query.exhibitions.findFirst({
    where: and(eq(exhibitions.code, code), eq(exhibitions.state, "PUBLISHED")),
    with: { images: true, sentences: { where: isNull(guideSentences.deletedAt) } },
  });
  if (!row) throw new TRPCError({ code: "NOT_FOUND" });
  const guide = storedDocument.nullable().parse(row.guide);
  return { exhibitionCode: row.code, document: expandDocument(guide, { images: row.images, sentences: row.sentences }) };
}
