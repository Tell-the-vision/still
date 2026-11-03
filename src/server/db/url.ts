// Local dev falls back to a default database; production must configure one (`next build` is exempt: no runtime env).
export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    throw new Error('DATABASE_URL is not set');
  }
  return 'postgres://localhost:5432/still';
}
