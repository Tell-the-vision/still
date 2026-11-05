import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { stillDocument } from "../../../shared/src/still-doc";
import { db } from "../db/client";
import { exhibitions } from "../db/schema";
import { expandDocument } from "./documents";

export async function getGuide(code: string) {
  const row = await db.query.exhibitions.findFirst({
    where: and(eq(exhibitions.code, code), eq(exhibitions.state, "PUBLISHED")),
    with: { images: true },
  });
  if (!row) throw new TRPCError({ code: "NOT_FOUND" });
  const guide = stillDocument.nullable().parse(row.guide);
  return { exhibitionCode: row.code, document: expandDocument(guide, { images: row.images }) };
}
