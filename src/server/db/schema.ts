import { relations, sql } from 'drizzle-orm';
import {
  bigint,
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
  smallint,
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

// Visitors, institution staff and STILL operators are all users, split by role (SPEC §10.2, §10.5).
export const users = pgTable(
  'users',
  {
    id: id(),
    role: text().notNull(),
    institutionId: uuid().references((): AnyPgColumn => institutions.id, { onDelete: 'restrict' }),
    status: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check('users_role_check', sql`${t.role} IN ('VISITOR', 'INSTITUTION', 'ADMIN')`),
    check('users_status_check', sql`${t.status} IN ('ACTIVE', 'SUSPENDED')`),
    check('users_institution_role_check', sql`(${t.role} = 'INSTITUTION') = (${t.institutionId} IS NOT NULL)`),
    index().on(t.institutionId),
  ],
);

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
    // PASSWORD identities only (institution staff and operators, SPEC §10.5).
    passwordHash: text(),
    mustChangePassword: boolean().notNull().default(false),
    failedLoginCount: smallint().notNull().default(0),
    lockedUntil: timestamptz(),
    lastLoginAt: timestamptz(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique().on(t.provider, t.subject),
    index().on(t.userId, t.createdAt, t.id),
    check('user_tokens_provider_check', sql`${t.provider} IN ('GOOGLE', 'PASSWORD')`),
    check('user_tokens_password_hash_check', sql`(${t.provider} = 'PASSWORD') = (${t.passwordHash} IS NOT NULL)`),
    check('user_tokens_refresh_token_google_only', sql`${t.provider} = 'GOOGLE' OR ${t.refreshTokenCiphertext} IS NULL`),
    check(
      'user_tokens_password_subject_check',
      sql`${t.provider} <> 'PASSWORD' OR (${t.subject} = lower(${t.subject}) AND ${t.subject} ~ '^[^@\\s]+@[^@\\s]+$')`,
    ),
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

// code is the institution ID staff type to sign in, e.g. STL-SEO-0001 (SPEC §10.3, Figma A9/A10).
export const institutions = pgTable(
  'institutions',
  {
    id: id(),
    code: text().notNull().unique(),
    status: text().notNull().default('ACTIVE'),
    name: text().notNull(),
    analysisDailyTokenLimit: bigint({ mode: 'number' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('institutions_code_check', sql`${t.code} ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'`),
    check('institutions_status_check', sql`${t.status} IN ('ACTIVE', 'SUSPENDED')`),
    check('institutions_analysis_daily_token_limit_check', sql`${t.analysisDailyTokenLimit} > 0`),
  ],
);

export const venues = pgTable(
  'venues',
  {
    id: id(),
    code: text().notNull().unique(),
    name: text().notNull(),
    city: text().notNull(),
    // Set when an institution registers the venue itself (SPEC §10.3).
    createdByInstitutionId: uuid().references(() => institutions.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [codeCheck('venues_code_check', t.code)],
);

// cover_image_id has no drizzle FK: the composite cover FK is hand-written in 0001.
// venue_id and the dates may be NULL only while state = DRAFT (SPEC §10.3).
export const exhibitions = pgTable(
  'exhibitions',
  {
    id: id(),
    code: text().notNull().unique(),
    institutionId: uuid().notNull().references(() => institutions.id, { onDelete: 'restrict' }),
    venueId: uuid().references(() => venues.id, { onDelete: 'restrict' }),
    title: text().notNull(),
    subtitle: text(),
    description: jsonb(),
    guide: jsonb(),
    startDate: date({ mode: 'string' }),
    endDate: date({ mode: 'string' }),
    coverImageId: uuid(),
    state: text().notNull(),
    ambienceEnabled: boolean().notNull().default(false),
    firstPublishedAt: timestamptz(),
    // The working copy (SPEC §10.9); draft_revision changes on every edit.
    draft: jsonb().notNull(),
    draftRevision: uuid().notNull().defaultRandom(),
    analysis: jsonb(),
    publishedRevision: uuid(),
    publishedAt: timestamptz(),
    publishedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    rightsStatementVersion: text(),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    codeCheck('exhibitions_code_check', t.code),
    check('exhibitions_dates_check', sql`${t.endDate} >= ${t.startDate}`),
    check('exhibitions_state_check', sql`${t.state} IN ('DRAFT', 'PUBLISHED', 'UNPUBLISHED')`),
    check(
      'exhibitions_published_fields_check',
      sql`${t.state} = 'DRAFT' OR (${t.venueId} IS NOT NULL AND ${t.startDate} IS NOT NULL AND ${t.endDate} IS NOT NULL)`,
    ),
    check('exhibitions_first_published_check', sql`(${t.state} = 'DRAFT') = (${t.firstPublishedAt} IS NULL)`),
    index().on(t.state, t.startDate),
    index().on(t.institutionId, t.state),
  ],
);

// Uploaded source files and the files unpacked from a ZIP (SPEC §10.6).
export const documents = pgTable(
  'documents',
  {
    id: id(),
    exhibitionId: uuid().notNull().references(() => exhibitions.id, { onDelete: 'cascade' }),
    parentId: uuid(),
    objectKey: text().notNull().unique(),
    originalName: text().notNull(),
    mediaType: text().notNull(),
    byteSize: bigint({ mode: 'number' }).notNull(),
    sha256: char({ length: 64 }).notNull(),
    category: text(),
    status: text().notNull(),
    errorCode: text(),
    duplicateOfId: uuid(),
    manifestObjectKey: text(),
    analyzedAt: timestamptz(),
    uploadedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique().on(t.exhibitionId, t.id),
    foreignKey({ name: 'documents_parent_fk', columns: [t.exhibitionId, t.parentId], foreignColumns: [t.exhibitionId, t.id] }).onDelete('cascade'),
    foreignKey({ name: 'documents_duplicate_of_fk', columns: [t.exhibitionId, t.duplicateOfId], foreignColumns: [t.exhibitionId, t.id] }).onDelete('cascade'),
    check('documents_byte_size_check', sql`${t.byteSize} > 0`),
    check(
      'documents_category_check',
      sql`${t.category} IN ('EXHIBITION_TEXT', 'ARTWORK_LIST', 'WALL_LABELS', 'AUDIO_SCRIPT', 'PRESS_KIT', 'IMAGE', 'OTHER')`,
    ),
    check('documents_status_check', sql`${t.status} IN ('UPLOADING', 'STORED', 'EXTRACTED', 'FAILED', 'DUPLICATE')`),
    check(
      'documents_error_code_check',
      sql`${t.errorCode} IN ('UNSUPPORTED_FORMAT', 'ENCRYPTED', 'CORRUPTED', 'ENCODING_UNKNOWN', 'EMPTY', 'MANIFEST_INVALID')`,
    ),
    // SPEC §10.6 status rules.
    check('documents_failed_error_check', sql`(${t.status} = 'FAILED') = (${t.errorCode} IS NOT NULL)`),
    check('documents_duplicate_check', sql`(${t.status} = 'DUPLICATE') = (${t.duplicateOfId} IS NOT NULL)`),
    check('documents_extracted_manifest_check', sql`(${t.status} = 'EXTRACTED') = (${t.manifestObjectKey} IS NOT NULL)`),
    index().on(t.exhibitionId, t.sha256),
  ],
);

// objectKey is NULL until the file behind a manifest asset is uploaded; such rows never reach visitors (SPEC §10.3).
export const images = pgTable(
  'images',
  {
    id: id(),
    exhibitionId: uuid().notNull().references(() => exhibitions.id, { onDelete: 'cascade' }),
    objectKey: text().unique(),
    width: integer().notNull(),
    height: integer().notNull(),
    altText: text(),
    credit: text(),
    documentId: uuid(),
    manifestAssetId: text(),
    rights: text().notNull(),
    verification: text().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique().on(t.exhibitionId, t.id),
    unique().on(t.documentId, t.manifestAssetId),
    foreignKey({ name: 'images_document_fk', columns: [t.exhibitionId, t.documentId], foreignColumns: [documents.exhibitionId, documents.id] }).onDelete('cascade'),
    check('images_width_check', sql`${t.width} > 0`),
    check('images_height_check', sql`${t.height} > 0`),
    check('images_rights_check', sql`${t.rights} IN ('UNCONFIRMED', 'CONFIRMED', 'RESTRICTED')`),
    check('images_verification_check', sql`${t.verification} IN ('UNVERIFIED', 'VERIFIED', 'MISMATCH', 'NOT_APPLICABLE')`),
    check('images_manifest_pair_check', sql`(${t.documentId} IS NULL) = (${t.manifestAssetId} IS NULL)`),
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

// Generated and edited guide text (SPEC §10.8).
export const contents = pgTable(
  'contents',
  {
    id: id(),
    exhibitionId: uuid().notNull().references(() => exhibitions.id, { onDelete: 'cascade' }),
    kind: text().notNull(),
    status: text().notNull(),
    blocks: jsonb().notNull(),
    fields: jsonb(),
    suggestions: jsonb().notNull().default(sql`'[]'::jsonb`),
    editorialNote: text(),
    revision: uuid().notNull().defaultRandom(),
    approvedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    approvedAt: timestamptz(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique().on(t.exhibitionId, t.id),
    index().on(t.exhibitionId, t.status),
    check(
      'contents_kind_check',
      sql`${t.kind} IN ('INTRODUCTION', 'ARTIST', 'CURATOR_STATEMENT', 'THEME', 'ARTWORK', 'GALLERY_SECTION', 'AUDIO_NARRATION', 'PRESS_EXCERPT', 'CLOSING', 'OTHER')`,
    ),
    check('contents_status_check', sql`${t.status} IN ('READY', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED')`),
    check('contents_approved_check', sql`(${t.status} = 'APPROVED') = (${t.approvedAt} IS NOT NULL)`),
    check('contents_approved_by_check', sql`${t.approvedAt} IS NOT NULL OR ${t.approvedBy} IS NULL`),
  ],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  institution: one(institutions, { fields: [users.institutionId], references: [institutions.id] }),
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
export const institutionsRelations = relations(institutions, ({ many }) => ({ exhibitions: many(exhibitions), users: many(users) }));
export const venuesRelations = relations(venues, ({ many }) => ({ exhibitions: many(exhibitions) }));
export const exhibitionsRelations = relations(exhibitions, ({ one, many }) => ({
  institution: one(institutions, { fields: [exhibitions.institutionId], references: [institutions.id] }),
  venue: one(venues, { fields: [exhibitions.venueId], references: [venues.id] }),
  documents: many(documents),
  contents: many(contents),
  images: many(images, { relationName: 'exhibitionImages' }),
  coverImage: one(images, { fields: [exhibitions.coverImageId], references: [images.id], relationName: 'exhibitionCover' }),
  playlist: one(exhibitionPlaylists),
  sentences: many(guideSentences),
  archives: many(archives),
}));
export const imagesRelations = relations(images, ({ one }) => ({
  exhibition: one(exhibitions, { fields: [images.exhibitionId], references: [exhibitions.id], relationName: 'exhibitionImages' }),
  document: one(documents, { fields: [images.documentId], references: [documents.id] }),
}));
export const documentsRelations = relations(documents, ({ one, many }) => ({
  exhibition: one(exhibitions, { fields: [documents.exhibitionId], references: [exhibitions.id] }),
  images: many(images),
}));
export const contentsRelations = relations(contents, ({ one }) => ({
  exhibition: one(exhibitions, { fields: [contents.exhibitionId], references: [exhibitions.id] }),
}));
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
