/**
 * Minimal .env loader for CLI entry points (drizzle-kit, seed scripts).
 *
 * Next.js loads .env on its own, but `drizzle-kit push` and `tsx src/db/seed.ts`
 * do not — without this, `npm run setup` would silently ignore DATABASE_URL /
 * DATABASE_AUTH_TOKEN and set up the local file DB instead of Turso.
 * Variables already present in the environment win over the file.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const file = path.resolve(process.cwd(), ".env");
if (existsSync(file)) {
  // Same precedence as dotenv: within the file the last occurrence of a key
  // wins; variables already in the real environment win over the file.
  const parsed: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) parsed[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  for (const [k, v] of Object.entries(parsed)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
