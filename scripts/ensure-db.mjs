/**
 * Runs before `next dev` (predev). Makes the first `npm run dev` just work:
 *   1. creates .env from .env.example if missing
 *   2. for the embedded local database (DATABASE_URL=file:./data/pg, PGlite)
 *      creates the schema + seeds sample exhibitions on first run, and
 *      re-applies the schema whenever src/db/schema.ts changed since
 *      (Postgres can ALTER in place, so local data survives).
 * For a remote Postgres (DATABASE_URL=postgres://…) it does nothing —
 * run `npm run setup` yourself once against that database.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";

function loadDotEnv() {
  const file = path.resolve(process.cwd(), ".env");
  if (!existsSync(file)) return;
  const parsed = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) parsed[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2"); // last occurrence wins (dotenv semantics)
  }
  for (const [k, v] of Object.entries(parsed)) if (process.env[k] === undefined) process.env[k] = v;
}

// First run: create .env from the example so defaults (ADMIN_EMAILS etc.) apply.
if (!existsSync(path.resolve(process.cwd(), ".env")) && existsSync(path.resolve(process.cwd(), ".env.example"))) {
  copyFileSync(path.resolve(process.cwd(), ".env.example"), path.resolve(process.cwd(), ".env"));
  console.log("[still] Created .env from .env.example");
}
loadDotEnv();
const url = process.env.DATABASE_URL || "file:./data/pg";
if (!url.startsWith("file:")) process.exit(0);

const dir = path.resolve(process.cwd(), url.slice("file:".length));
mkdirSync(dir, { recursive: true });
const hashFile = path.join(dir, ".schema-hash");
const schemaHash = createHash("sha1")
  .update(readFileSync(path.resolve(process.cwd(), "src/db/schema.ts")))
  .digest("hex");
const initialized = existsSync(path.join(dir, "PG_VERSION"));
const previousHash = existsSync(hashFile) ? readFileSync(hashFile, "utf8").trim() : "";

if (initialized && previousHash === schemaHash) process.exit(0);

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (!initialized) {
  console.log(`[still] No database at ${dir} — creating schema and seeding sample data…`);
  run("npx", ["drizzle-kit", "push", "--force"]);
  run("npx", ["tsx", "src/db/seed.ts"]);
} else {
  console.log("[still] src/db/schema.ts changed — applying schema changes to the local database…");
  run("npx", ["drizzle-kit", "push", "--force"]);
}
writeFileSync(hashFile, schemaHash);
