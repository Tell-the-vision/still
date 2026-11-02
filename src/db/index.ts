/**
 * Database client (server-only).
 *
 * Local dev  → SQLite file at DATABASE_URL (default file:./data/still.db)
 * Production → the same code works against Turso (libsql://…) by setting
 *              DATABASE_URL + DATABASE_AUTH_TOKEN.
 */
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export const DEFAULT_DATABASE_URL = "file:./data/still.db";

function ensureLocalDir(url: string) {
  if (!url.startsWith("file:")) return;
  const file = url.slice("file:".length);
  const dir = path.dirname(path.resolve(process.cwd(), file));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function makeClient(): Client {
  const url = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  ensureLocalDir(url);
  const client = createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });
  // SQLite does not enforce FK constraints unless asked. We also delete
  // dependants explicitly (see lib/archives.ts) so correctness never relies
  // on this pragma alone.
  void client.execute("PRAGMA foreign_keys = ON").catch(() => {});
  return client;
}

// Cache across Next.js dev hot-reloads so we do not open a new connection
// on every module evaluation.
const globalForDb = globalThis as unknown as { __stillClient?: Client };
const client = globalForDb.__stillClient ?? makeClient();
if (process.env.NODE_ENV !== "production") globalForDb.__stillClient = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
export { schema };
