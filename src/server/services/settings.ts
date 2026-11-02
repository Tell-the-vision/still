import { eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { settingsUpdateInput } from "@still/shared/settings";
import { db } from "../db/client";
import { userSettings } from "../db/schema";

// SPEC §6.1: no row means the default, AUTO.
export async function getSettings(userId: string) {
  const row = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) });
  return settingsUpdateInput.parse({ audioMode: row?.audioMode ?? "AUTO" });
}

export async function updateSettings(userId: string, input: z.infer<typeof settingsUpdateInput>) {
  const [row] = await db
    .insert(userSettings)
    .values({ userId, audioMode: input.audioMode })
    .onConflictDoUpdate({ target: userSettings.userId, set: { audioMode: input.audioMode, updatedAt: sql`now()` } })
    .returning();
  return settingsUpdateInput.parse({ audioMode: row.audioMode });
}
