/**
 * Runs before `npm run dev`: if the local SQLite file does not exist yet,
 * create the schema and seed sample exhibitions so a fresh clone works with
 * `npm install && npm run dev`. Does nothing for remote (libsql://) URLs.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

function loadDotEnv() {
  const file = path.resolve(process.cwd(), ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

loadDotEnv();
const url = process.env.DATABASE_URL || "file:./data/still.db";
if (!url.startsWith("file:")) process.exit(0);

const file = path.resolve(process.cwd(), url.slice("file:".length));
mkdirSync(path.dirname(file), { recursive: true });
if (existsSync(file)) process.exit(0);

console.log(`[still] No database at ${file} — creating schema and seeding sample data…`);
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run("npx", ["drizzle-kit", "push", "--force"]);
run("npx", ["tsx", "src/db/seed.ts"]);
