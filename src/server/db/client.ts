import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Cached on globalThis so `next dev` HMR does not leak connections.
const globalForPool = globalThis as unknown as { stillPool?: Pool };

const pool =
  globalForPool.stillPool ??
  new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://localhost:5432/still' });
globalForPool.stillPool = pool;

export const db = drizzle({ client: pool, schema, casing: 'snake_case' });
