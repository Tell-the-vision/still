import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  customType,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
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

// cover_image_id has no drizzle FK: the composite cover FK is hand-written in 0001.
export const exhibitions = pgTable(
  'exhibitions',
  {
    id: id(),
    code: text().notNull().unique(),
    institutionId: uuid().notNull().references(() => institutions.id, { onDelete: 'restrict' }),
    venueId: uuid().notNull().references(() => venues.id, { onDelete: 'restrict' }),
    title: text().notNull(),
    description: jsonb(),
    guide: jsonb(),
    startDate: date({ mode: 'string' }).notNull(),
    endDate: date({ mode: 'string' }).notNull(),
    coverImageId: uuid(),
    status: text().notNull(),
    ambienceEnabled: boolean().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    codeCheck('exhibitions_code_check', t.code),
    check('exhibitions_dates_check', sql`${t.endDate} >= ${t.startDate}`),
    check('exhibitions_status_check', sql`${t.status} IN ('DRAFT', 'PUBLISHED')`),
  ],
);

export const images = pgTable(
  'images',
  {
    id: id(),
    exhibitionId: uuid().notNull().references(() => exhibitions.id, { onDelete: 'cascade' }),
    objectKey: text().notNull().unique(),
    width: integer().notNull(),
    height: integer().notNull(),
    altText: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique().on(t.exhibitionId, t.id),
    check('images_width_check', sql`${t.width} > 0`),
    check('images_height_check', sql`${t.height} > 0`),
  ],
);

export const exhibitionPlaylists = pgTable(
  'exhibition_playlists',
  {
    exhibitionId: uuid().primaryKey().references(() => exhibitions.id, { onDelete: 'cascade' }),
    provider: text().notNull(),
    url: text().notNull(),
    title: text().notNull(),
    description: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('exhibition_playlists_provider_check', sql`${t.provider} IN ('APPLE_MUSIC', 'SPOTIFY')`),
    check(
      'exhibition_playlists_url_check',
      sql`(${t.provider} = 'SPOTIFY' AND ${t.url} LIKE 'https://open.spotify.com/%') OR (${t.provider} = 'APPLE_MUSIC' AND ${t.url} LIKE 'https://music.apple.com/%')`,
    ),
  ],
);

export const guideSentences = pgTable(
  'guide_sentences',
  {
    id: id(),
    exhibitionId: uuid().notNull().references(() => exhibitions.id, { onDelete: 'cascade' }),
    content: text().notNull(),
    deletedAt: timestamptz(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique().on(t.exhibitionId, t.id),
    index().on(t.exhibitionId).where(sql`${t.deletedAt} IS NULL`),
  ],
);

export const archives = pgTable(
  'archives',
  {
    id: id(),
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    exhibitionId: uuid().notNull().references(() => exhibitions.id, { onDelete: 'restrict' }),
    lastVisitedAt: timestamptz().notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    unique().on(t.userId, t.exhibitionId),
    unique().on(t.id, t.exhibitionId),
    index().on(t.userId, t.lastVisitedAt.desc().nullsFirst(), t.id.desc().nullsFirst()),
    index().on(t.exhibitionId),
  ],
);

export const scraps = pgTable(
  'scraps',
  {
    archiveId: uuid().notNull(),
    exhibitionId: uuid().notNull(),
    guideSentenceId: uuid().notNull(),
    sentenceContentSnapshot: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.archiveId, t.guideSentenceId] }),
    foreignKey({ columns: [t.archiveId, t.exhibitionId], foreignColumns: [archives.id, archives.exhibitionId] }).onDelete('cascade'),
    foreignKey({ name: 'scraps_sentence_fk', columns: [t.exhibitionId, t.guideSentenceId], foreignColumns: [guideSentences.exhibitionId, guideSentences.id] }).onDelete('restrict'),
    index().on(t.exhibitionId, t.guideSentenceId),
  ],
);

export const journals = pgTable(
  'journals',
  {
    archiveId: uuid().primaryKey().references(() => archives.id, { onDelete: 'cascade' }),
    content: text().notNull(),
    audioType: text(),
    revision: uuid().notNull().defaultRandom(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check('journals_audio_type_check', sql`${t.audioType} IN ('EXTERNAL', 'AMBIENCE', 'NONE')`)],
);

export const digitalKeepsakes = pgTable('digital_keepsakes', {
  archiveId: uuid().primaryKey().references(() => archives.id, { onDelete: 'cascade' }),
  templateId: text().notNull(),
  contentData: jsonb().notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  tokens: many(userTokens),
  sessions: many(userSessions),
  settings: one(userSettings),
  consents: many(userConsents),
  archives: many(archives),
}));
export const userTokensRelations = relations(userTokens, ({ one, many }) => ({
  user: one(users, { fields: [userTokens.userId], references: [users.id] }),
  sessions: many(userSessions),
}));
export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, { fields: [userSessions.userId], references: [users.id] }),
  userToken: one(userTokens, { fields: [userSessions.userTokenId], references: [userTokens.id] }),
}));
export const userSettingsRelations = relations(userSettings, ({ one }) => ({ user: one(users, { fields: [userSettings.userId], references: [users.id] }) }));
export const userConsentsRelations = relations(userConsents, ({ one }) => ({ user: one(users, { fields: [userConsents.userId], references: [users.id] }) }));
export const institutionsRelations = relations(institutions, ({ many }) => ({ exhibitions: many(exhibitions) }));
export const venuesRelations = relations(venues, ({ many }) => ({ exhibitions: many(exhibitions) }));
export const exhibitionsRelations = relations(exhibitions, ({ one, many }) => ({
  institution: one(institutions, { fields: [exhibitions.institutionId], references: [institutions.id] }),
  venue: one(venues, { fields: [exhibitions.venueId], references: [venues.id] }),
  images: many(images, { relationName: 'exhibitionImages' }),
  coverImage: one(images, { fields: [exhibitions.coverImageId], references: [images.id], relationName: 'exhibitionCover' }),
  playlist: one(exhibitionPlaylists),
  sentences: many(guideSentences),
  archives: many(archives),
}));
export const imagesRelations = relations(images, ({ one }) => ({ exhibition: one(exhibitions, { fields: [images.exhibitionId], references: [exhibitions.id], relationName: 'exhibitionImages' }) }));
export const exhibitionPlaylistsRelations = relations(exhibitionPlaylists, ({ one }) => ({ exhibition: one(exhibitions, { fields: [exhibitionPlaylists.exhibitionId], references: [exhibitions.id] }) }));
export const guideSentencesRelations = relations(guideSentences, ({ one, many }) => ({
  exhibition: one(exhibitions, { fields: [guideSentences.exhibitionId], references: [exhibitions.id] }),
  scraps: many(scraps),
}));
export const archivesRelations = relations(archives, ({ one, many }) => ({
  user: one(users, { fields: [archives.userId], references: [users.id] }),
  exhibition: one(exhibitions, { fields: [archives.exhibitionId], references: [exhibitions.id] }),
  scraps: many(scraps),
  journal: one(journals),
  keepsake: one(digitalKeepsakes),
}));
export const scrapsRelations = relations(scraps, ({ one }) => ({
  archive: one(archives, { fields: [scraps.archiveId], references: [archives.id] }),
  sentence: one(guideSentences, { fields: [scraps.guideSentenceId], references: [guideSentences.id] }),
}));
export const journalsRelations = relations(journals, ({ one }) => ({ archive: one(archives, { fields: [journals.archiveId], references: [archives.id] }) }));
export const digitalKeepsakesRelations = relations(digitalKeepsakes, ({ one }) => ({ archive: one(archives, { fields: [digitalKeepsakes.archiveId], references: [archives.id] }) }));
