/**
 * Database client (server-only). PostgreSQL via Drizzle ORM.
 *
 * Local dev  → PGlite, an embedded Postgres that stores its files under
 *              DATABASE_URL=file:./data/pg (default). Nothing to install.
 * Production → DATABASE_URL=postgres://… (Neon, Supabase, Railway, RDS …)
 *              through postgres.js. Same schema, same queries.
 *
 * Both drivers expose the identical Drizzle API, so the rest of the app
 * never knows which one is active.
 */
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export const DEFAULT_DATABASE_URL = "file:./data/pg";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export function databaseUrl() {
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

/** True when DATABASE_URL points at the embedded PGlite data directory. */
export function isEmbeddedDatabase(url = databaseUrl()) {
  return url.startsWith("file:");
}

let closer: (() => Promise<void>) | null = null;

/** Flush and close the underlying connection (scripts only; the app never calls this). */
export async function closeDb() {
  await closer?.();
  closer = null;
}

function makeDb(): Db {
  const url = databaseUrl();

  if (isEmbeddedDatabase(url)) {
    const dir = path.resolve(process.cwd(), url.slice("file:".length));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // Lazy require keeps the WASM bundle out of the production build when a
    // real Postgres is configured.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
    const client = new PGlite(dir);
    closer = () => client.close();
    return drizzlePglite(client, { schema });
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const postgres = require("postgres") as typeof import("postgres");
  const sql = postgres(url, {
    // Serverless-friendly: small pool, no server-side prepared statements so
    // it also works behind transaction-mode poolers (Supabase, PgBouncer).
    max: Number(process.env.DATABASE_POOL_MAX || 5),
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: sslMode(url),
  });
  closer = () => sql.end({ timeout: 5 });
  return drizzlePg(sql, { schema });
}

function sslMode(url: string): "require" | boolean {
  if (process.env.DATABASE_SSL === "false") return false;
  if (process.env.DATABASE_SSL === "require") return "require";
  // Hosted providers need TLS; a plain localhost/docker Postgres usually does not.
  try {
    const host = new URL(url).hostname;
    const local = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "db" || host === "postgres";
    return local ? false : "require";
  } catch {
    return "require";
  }
}

// Lazy + cached:
//  - Lazy: the connection (or the PGlite instance) is created on the first
//    query, not on import. Next.js dev imports server modules in helper
//    worker processes (e.g. to look for generateStaticParams); an eager
//    PGlite in each of them would fight over ./data/pg and abort.
//  - Cached on globalThis so dev hot-reloads reuse one instance.
const globalForDb = globalThis as unknown as { __stillDb?: Db };
function real(): Db {
  return (globalForDb.__stillDb ??= makeDb());
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const r = real();
    const value = Reflect.get(r, prop, r);
    return typeof value === "function" ? value.bind(r) : value;
  },
});

export { schema };
