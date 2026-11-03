import { desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { userConsents } from "../db/schema";

const toConsent = (row: typeof userConsents.$inferSelect) => ({ termsVersion: row.termsVersion, privacyVersion: row.privacyVersion, agreedAt: row.agreedAt.toISOString() });

// The user's latest agreement, or null if they never agreed.
export async function getConsent(userId: string) {
  const [row] = await db.select().from(userConsents).where(eq(userConsents.userId, userId)).orderBy(desc(userConsents.agreedAt)).limit(1);
  return row ? toConsent(row) : null;
}

// Idempotent: agreeing again to the same versions keeps the first row.
export async function recordConsent(userId: string, versions: { termsVersion: string; privacyVersion: string }) {
  const [inserted] = await db.insert(userConsents).values({ userId, ...versions }).onConflictDoNothing().returning();
  return { consent: inserted ? toConsent(inserted) : (await getConsent(userId))!, created: !!inserted };
}
