import { db } from "../db/client";
import { images } from "../db/schema";
import { deleteObject, listObjects } from "./r2";

// Deletes R2 objects under exhibitions/ that no images row references (SPEC §10.5).
async function reconcile() {
  if (process.env.R2_DRY_RUN === "1") {
    throw new Error("Refusing to reconcile with R2_DRY_RUN=1: the bucket would not be listed for real");
  }
  const referenced = new Set(
    (await db.select({ key: images.objectKey }).from(images)).flatMap((row) => (row.key === null ? [] : [row.key])),
  );
  const orphans = (await listObjects("exhibitions/")).filter((key) => !referenced.has(key));

  if (process.argv.includes("--dry-run")) {
    console.log(`orphans: ${orphans.length}`);
    return;
  }
  for (const key of orphans) await deleteObject(key);
  console.log(`deleted ${orphans.length}`);
}

reconcile()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : "reconcile failed");
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
