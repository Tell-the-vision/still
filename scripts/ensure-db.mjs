/**
 * Runs before `npm run dev`: if the local SQLite file does not exist yet,
 * create the schema and seed sample exhibitions so a fresh clone works with
 * `npm install && npm run dev`. Does nothing for remote (libsql://) URLs.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
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
const url = process.env.DATABASE_URL || "file:./data/still.db";
if (!url.startsWith("file:")) process.exit(0);

const file = path.resolve(process.cwd(), url.slice("file:".length));
mkdirSync(path.dirname(file), { recursive: true });

if (existsSync(file)) {
  // Schema drift check: columns added after the first release. SQLite cannot
  // always ALTER in place, so ask for a reset instead of failing later.
  try {
    const { createClient } = await import("@libsql/client");
    const client = createClient({ url });
    const cols = await client.execute("PRAGMA table_info(exhibitions)");
    const names = cols.rows.map((r) => String(r.name));
    client.close();
    if (names.length && (!names.includes("owner_id") || !names.includes("theme_bg"))) {
      console.error(
        "\n[still] Your local database predates the latest schema (roles / exhibition theme).\n" +
          "        Run `npm run db:reset` once (this deletes local test data), then `npm run dev` again.\n",
      );
      process.exit(1);
    }
  } catch {
    /* can't inspect — let the app report problems itself */
  }
  process.exit(0);
}

console.log(`[still] No database at ${file} — creating schema and seeding sample data…`);
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run("npx", ["drizzle-kit", "push", "--force"]);
run("npx", ["tsx", "src/db/seed.ts"]);
