import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { databaseUrl } from './url';

// Cached on globalThis so `next dev` HMR does not leak connections.
const globalForPool = globalThis as unknown as { stillPool?: Pool };

const pool =
  globalForPool.stillPool ??
  new Pool({ connectionString: databaseUrl() });
globalForPool.stillPool = pool;

export const db = drizzle({ client: pool, schema, casing: 'snake_case' });
