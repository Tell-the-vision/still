import "./src/db/load-env";
import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "file:./data/pg";
const embedded = url.startsWith("file:");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  // Local dev: PGlite data directory. Production: any Postgres URL.
  ...(embedded ? { driver: "pglite" as const, dbCredentials: { url: url.slice("file:".length) } } : { dbCredentials: { url } }),
});
