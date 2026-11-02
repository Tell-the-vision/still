import { sql } from 'drizzle-orm';
import {
  char,
  check,
  customType,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

export const id = () => uuid().primaryKey().defaultRandom();

// precision 3 matches JS Date; see plan §2.4.
const timestamptz = () => timestamp({ withTimezone: true, precision: 3 });
export const createdAt = () => timestamptz().notNull().defaultNow();
export const updatedAt = () =>
  timestamptz().notNull().defaultNow().$onUpdate(() => new Date());

export const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });

export const codeCheck = (name: string, column: AnyPgColumn) =>
  check(name, sql`${column} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`);

export const users = pgTable('users', { id: id(), createdAt: createdAt() });

export const userTokens = pgTable(
  'user_tokens',
  {
    id: id(),
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    provider: text().notNull(),
    subject: text().notNull(),
    email: text(),
    displayName: text(),
    refreshTokenCiphertext: bytea(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique().on(t.provider, t.subject),
    index().on(t.userId, t.createdAt, t.id),
    check('user_tokens_provider_check', sql`${t.provider} IN ('GOOGLE')`),
  ],
);

export const userSessions = pgTable(
  'user_sessions',
  {
    id: id(),
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    userTokenId: uuid().references(() => userTokens.id, { onDelete: 'set null' }),
    kind: text().notNull(),
    tokenHash: char({ length: 64 }).notNull().unique(),
    previousTokenHash: char({ length: 64 }),
    rotatedAt: timestamptz(),
    expiresAt: timestamptz().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check('user_sessions_kind_check', sql`${t.kind} IN ('WEB', 'APP')`),
    check('user_sessions_previous_token_hash_app_only', sql`${t.kind} = 'APP' OR ${t.previousTokenHash} IS NULL`),
    check('user_sessions_rotation_pair', sql`(${t.previousTokenHash} IS NULL) = (${t.rotatedAt} IS NULL)`),
    uniqueIndex().on(t.previousTokenHash).where(sql`${t.previousTokenHash} IS NOT NULL`),
    index().on(t.userId),
    index().on(t.expiresAt),
  ],
);

// No DEFAULT on audio_mode: the default (AUTO) lives in code.
export const userSettings = pgTable(
  'user_settings',
  {
    userId: uuid().primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    audioMode: text().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check('user_settings_audio_mode_check', sql`${t.audioMode} IN ('AUTO', 'NONE')`)],
);

export const userConsents = pgTable(
  'user_consents',
  {
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    termsVersion: text().notNull(),
    privacyVersion: text().notNull(),
    agreedAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.termsVersion, t.privacyVersion] })],
);

export const institutions = pgTable(
  'institutions',
  {
    id: id(),
    code: text().notNull().unique(),
    name: text().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [codeCheck('institutions_code_check', t.code)],
);

export const venues = pgTable(
  'venues',
  {
    id: id(),
    code: text().notNull().unique(),
    name: text().notNull(),
    city: text().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [codeCheck('venues_code_check', t.code)],
);
