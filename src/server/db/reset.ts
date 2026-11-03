import { Pool } from 'pg';
import { databaseUrl } from './url';

// Wipes the database. Refuses to touch anything that is not a STILL database.
const url = new URL(databaseUrl());
const name = url.pathname.slice(1);
if (!name.startsWith('still')) {
  throw new Error(`Refusing to reset database "${name}": name must start with "still"`);
}

const pool = new Pool({ connectionString: url.toString() });
pool
  .query('DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public')
  .then(() => pool.end())
  .then(() => console.log(`Reset database "${name}"`))
  .catch((e) => { console.error(e); process.exit(1); });
