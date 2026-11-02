/**
 * Delete the local SQLite file and rebuild it from schema + seed.
 *   npm run db:reset
 */
import { existsSync, rmSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const envFile = path.resolve(process.cwd(), ".env");
if (existsSync(envFile)) {
  const parsed = {};
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) parsed[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2"); // last occurrence wins (dotenv semantics)
  }
  for (const [k, v] of Object.entries(parsed)) if (process.env[k] === undefined) process.env[k] = v;
}
const url = process.env.DATABASE_URL || "file:./data/still.db";
if (!url.startsWith("file:")) {
  console.error("db:reset only supports local file: databases.");
  process.exit(1);
}
const file = path.resolve(process.cwd(), url.slice("file:".length));
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  if (existsSync(file + suffix)) rmSync(file + suffix);
}
console.log(`[still] Removed ${file}`);
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run("npx", ["drizzle-kit", "push", "--force"]);
run("npx", ["tsx", "src/db/seed.ts"]);
