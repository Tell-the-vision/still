import { defineConfig } from 'drizzle-kit';
import { databaseUrl } from './url';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './src/server/db/migrations',
  casing: 'snake_case',
  dbCredentials: {
    url: databaseUrl(),
  },
});
