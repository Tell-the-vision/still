import type { StoredDocument } from "@still/shared/document";
import { and, eq, isNull, notInArray, sql } from "drizzle-orm";
import { db } from "../client";
import { exhibitionPlaylists, exhibitions, guideSentences, institutions, venues } from "../schema";
import type { ContentPackage } from "./content";
import { sentenceRefs, validatePackage } from "./validate";

// Idempotent operator import (SPEC §9): safe to rerun with the same or an edited package.
// The whole package is one transaction, so a failed import leaves no partial rows.
export async function importPackage(pkg: ContentPackage) {
  validatePackage(pkg);
  await db.transaction(async (tx) => {
    const [institution] = await tx
      .insert(institutions)
      .values(pkg.institution)
      .onConflictDoUpdate({ target: institutions.code, set: { name: pkg.institution.name } })
      .returning();

    const venueIds = new Map<string, string>();
    for (const venue of pkg.venues) {
      const [row] = await tx
        .insert(venues)
        .values(venue)
        .onConflictDoUpdate({ target: venues.code, set: { name: venue.name, city: venue.city } })
        .returning();
      venueIds.set(venue.code, row.id);
    }

    for (const { venueCode, playlist, sentences, code, ...fields } of pkg.exhibitions) {
      const venueId = venueIds.get(venueCode);
      if (!venueId) throw new Error(`Unknown venue "${venueCode}" in exhibition "${code}"`);
      const mutable = { ...fields, institutionId: institution.id, venueId };

      const [exhibition] = await tx
        .insert(exhibitions)
        .values({ code, ...mutable })
        .onConflictDoUpdate({ target: exhibitions.code, set: mutable })
        .returning();

      for (const s of sentences) {
        await tx
          .insert(guideSentences)
          .values({ id: s.id, exhibitionId: exhibition.id, content: s.content })
          .onConflictDoUpdate({ target: guideSentences.id, set: { content: s.content, deletedAt: null } });
      }
      await tx
        .update(guideSentences)
        .set({ deletedAt: sql`now()` })
        .where(and(
          eq(guideSentences.exhibitionId, exhibition.id),
          notInArray(guideSentences.id, sentences.map((s) => s.id)),
        ));

      if (playlist) {
        await tx
          .insert(exhibitionPlaylists)
          .values({ exhibitionId: exhibition.id, ...playlist })
          .onConflictDoUpdate({ target: exhibitionPlaylists.exhibitionId, set: playlist });
      } else {
        await tx.delete(exhibitionPlaylists).where(eq(exhibitionPlaylists.exhibitionId, exhibition.id));
      }

      // Before commit: live sentences must be exactly the ones the stored guide references.
      const live = await tx
        .select({ id: guideSentences.id })
        .from(guideSentences)
        .where(and(eq(guideSentences.exhibitionId, exhibition.id), isNull(guideSentences.deletedAt)));
      const referenced = new Set(sentenceRefs(exhibition.guide as StoredDocument | null));
      if (live.length !== referenced.size || live.some((r) => !referenced.has(r.id))) {
        throw new Error(`Exhibition "${code}": stored guide and live sentences differ`);
      }
    }
  });
}
