import { Pool } from 'pg';

// Wipes the database. Refuses to touch anything that is not a STILL database.
const url = new URL(process.env.DATABASE_URL ?? 'postgres://localhost:5432/still');
const name = url.pathname.slice(1);
if (!name.startsWith('still')) {
  throw new Error(`Refusing to reset database "${name}": name must start with "still"`);
}

const pool = new Pool({ connectionString: url.toString() });
await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
await pool.query('DROP SCHEMA public CASCADE');
await pool.query('CREATE SCHEMA public');
await pool.end();
console.log(`Reset database "${name}"`);
