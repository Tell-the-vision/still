import { sql } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import type { db } from "../../db/client";
import { deleteObject, deletePrefix, deletePrivateObject, deletePrivatePrefix } from "../../media/r2";

// SPEC §10.10 storage.delete, §10.11 R2 객체 수명: object deletes are jobs, so a failed delete is retried
// (5 times, exponential backoff) instead of silently leaving an orphan.
export const STORAGE_DELETE_QUEUE = "storage.delete";
export const STORAGE_DELETE_OPTIONS = { retryLimit: 5, retryDelay: 30, retryBackoff: true };
export type StorageDelete = { bucket: "private" | "public" | "modelInputs"; key?: string; prefix?: string };

// Sends the jobs through the caller's transaction, so they exist exactly when the row deletes commit.
// pg-boss takes any object with executeSql; a drizzle transaction is adapted by turning $n into bound values.
export async function enqueueStorageDeletes(boss: PgBoss, tx: Pick<typeof db, "execute">, jobs: StorageDelete[]) {
  const executeSql = async (text: string, values: unknown[] = []) => {
    const parts = text.split(/\$(\d+)/);
    const query = sql.join(parts.map((part, i) => (i % 2 ? sql`${values[Number(part) - 1]}` : sql.raw(part))), sql.raw(""));
    const { rows } = await tx.execute(query);
    return { rows };
  };
  for (const job of jobs) {
    await boss.send(STORAGE_DELETE_QUEUE, job, { singletonKey: `${job.bucket}:${job.key ?? job.prefix}`, ...STORAGE_DELETE_OPTIONS, db: { executeSql } });
  }
}

export async function runStorageDelete({ bucket, key, prefix }: StorageDelete) {
  if (bucket === "modelInputs") throw new Error("modelInputs deletes are not supported yet");
  if (bucket === "private") return key ? deletePrivateObject(key) : deletePrivatePrefix(prefix!);
  return key ? deleteObject(key) : deletePrefix(prefix!);
}
