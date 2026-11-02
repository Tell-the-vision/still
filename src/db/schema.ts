/**
 * STILL — database schema (Drizzle ORM, SQLite / libsql)
 *
 * Mirrors "Developer Functional Specification §11 Data Model".
 * Key constraints:
 *   - archives:  UNIQUE (user_id, exhibition_id)      → CORE-03
 *   - journals:  UNIQUE (archive_id)                  → CORE-04
 *   - scraps:    UNIQUE (archive_id, guide_sentence_id)
 *   - every personal record cascades from archives    → CORE-09
 */
import { relations, sql } from "drizzle-orm";
import {
  blob,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());

// ---------------------------------------------------------------- users
/**
 * Roles (cumulative):
 *   guest  (no row)  — can read exhibitions
 *   USER             — + personal archive / scraps / journal / keepsake / like / report
 *   ARTIST           — + create / edit / publish own exhibitions and get their QR
 *   ADMIN            — + manage users, artist approvals, all exhibitions, reports
 */
export const USER_ROLE = ["USER", "ARTIST", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLE)[number];
export const USER_STATUS = ["ACTIVE", "SUSPENDED"] as const;
export type UserStatus = (typeof USER_STATUS)[number];
/** Artist verification state. A user becomes ARTIST only when an admin approves. */
export const ARTIST_STATUS = ["NONE", "PENDING", "APPROVED", "REJECTED"] as const;
export type ArtistStatus = (typeof ARTIST_STATUS)[number];

export const users = sqliteTable("users", {
  id: id(),
  /** Google `sub`. Dev-login users use `dev:<email>`. */
  googleId: text("google_id").notNull().unique(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull().default(""),
  image: text("image"),
  role: text("role", { enum: USER_ROLE }).notNull().default("USER"),
  status: text("status", { enum: USER_STATUS }).notNull().default("ACTIVE"),
  artistStatus: text("artist_status", { enum: ARTIST_STATUS }).notNull().default("NONE"),
  artistName: text("artist_name"),
  artistBio: text("artist_bio"),
  artistPortfolioUrl: text("artist_portfolio_url"),
  artistAppliedAt: integer("artist_applied_at", { mode: "timestamp_ms" }),
  artistReviewedAt: integer("artist_reviewed_at", { mode: "timestamp_ms" }),
  /** Admin's note on approval / rejection (shown to the applicant). */
  artistReviewNote: text("artist_review_note"),
  suspendedReason: text("suspended_reason"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------------------------------------------------------- exhibitions
/**
 * DRAFT   — artist is still editing; invisible to the public
 * ACTIVE  — published (QR works)
 * HIDDEN  — taken down by an admin (e.g. after a report); owner can still see it
 * DELETED — soft-deleted by owner/admin; user archives keep the exhibition info
 */
export const EXHIBITION_STATUS = ["DRAFT", "ACTIVE", "HIDDEN", "DELETED"] as const;
export type ExhibitionStatus = (typeof EXHIBITION_STATUS)[number];

export const exhibitions = sqliteTable("exhibitions", {
  id: id(),
  /** NULL = official / seeded content. Otherwise the artist who created it. */
  ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
  /** URL-safe identifier used in QR codes: /e/<slug> */
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  venue: text("venue"),
  /** ISO date (YYYY-MM-DD) */
  startDate: text("start_date"),
  endDate: text("end_date"),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  qrCodeUrl: text("qr_code_url"),
  status: text("status", { enum: EXHIBITION_STATUS }).notNull().default("DRAFT"),
  publishedAt: integer("published_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ------------------------------------------------------ guide_sentences
export const guideSentences = sqliteTable(
  "guide_sentences",
  {
    id: id(),
    exhibitionId: text("exhibition_id")
      .notNull()
      .references(() => exhibitions.id, { onDelete: "cascade" }),
    /** Optional grouping label (e.g. artwork title / chapter). */
    section: text("section"),
    content: text("content").notNull(),
    sequence: integer("sequence").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("guide_sentences_exhibition_idx").on(t.exhibitionId, t.sequence)],
);

// -------------------------------------------------- audio_configurations
export const AUDIO_PROVIDER = ["APPLE_MUSIC", "SPOTIFY", "NONE"] as const;
export type AudioProvider = (typeof AUDIO_PROVIDER)[number];
export const AMBIENCE_TYPE = ["PINK_NOISE"] as const;
export type AmbienceType = (typeof AMBIENCE_TYPE)[number];

export const audioConfigurations = sqliteTable("audio_configurations", {
  id: id(),
  exhibitionId: text("exhibition_id")
    .notNull()
    .unique()
    .references(() => exhibitions.id, { onDelete: "cascade" }),
  audioProvider: text("audio_provider", { enum: AUDIO_PROVIDER }).notNull().default("NONE"),
  playlistUrl: text("playlist_url"),
  playlistTitle: text("playlist_title"),
  playlistDescription: text("playlist_description"),
  ambienceEnabled: integer("ambience_enabled", { mode: "boolean" }).notNull().default(true),
  ambienceType: text("ambience_type", { enum: AMBIENCE_TYPE }).notNull().default("PINK_NOISE"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ------------------------------------------------------------- archives
export const archives = sqliteTable(
  "archives",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    exhibitionId: text("exhibition_id")
      .notNull()
      .references(() => exhibitions.id, { onDelete: "cascade" }),
    firstVisitedAt: integer("first_visited_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    lastVisitedAt: integer("last_visited_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("archives_user_exhibition_unique").on(t.userId, t.exhibitionId),
    index("archives_user_idx").on(t.userId),
  ],
);

// --------------------------------------------------------------- scraps
export const scraps = sqliteTable(
  "scraps",
  {
    id: id(),
    archiveId: text("archive_id")
      .notNull()
      .references(() => archives.id, { onDelete: "cascade" }),
    /** Nullable so a scrap survives if the organiser later removes the sentence. */
    guideSentenceId: text("guide_sentence_id").references(() => guideSentences.id, {
      onDelete: "set null",
    }),
    /** The sentence as it read when the user saved it (immutable snapshot). */
    sentenceContentSnapshot: text("sentence_content_snapshot").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("scraps_archive_sentence_unique").on(t.archiveId, t.guideSentenceId),
    index("scraps_archive_idx").on(t.archiveId),
  ],
);

// ------------------------------------------------------------- journals
export const JOURNAL_AUDIO_TYPE = ["EXTERNAL_PLAYLIST", "AMBIENCE", "NONE"] as const;
export type JournalAudioType = (typeof JOURNAL_AUDIO_TYPE)[number];

export const journals = sqliteTable("journals", {
  id: id(),
  /** UNIQUE → exactly one journal per archive (CORE-04). */
  archiveId: text("archive_id")
    .notNull()
    .unique()
    .references(() => archives.id, { onDelete: "cascade" }),
  content: text("content").notNull().default(""),
  audioType: text("audio_type", { enum: JOURNAL_AUDIO_TYPE }).notNull().default("NONE"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------------------------------------------------- digital_keepsakes
export const digitalKeepsakes = sqliteTable(
  "digital_keepsakes",
  {
    id: id(),
    archiveId: text("archive_id")
      .notNull()
      .references(() => archives.id, { onDelete: "cascade" }),
    /** One of the ids in `src/lib/keepsake-templates.ts`. */
    templateId: text("template_id").notNull(),
    /** JSON string — see `KeepsakeContent` in keepsake-templates.ts. */
    contentData: text("content_data").notNull().default("{}"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("keepsakes_archive_idx").on(t.archiveId)],
);

// ------------------------------------------------------ exhibition_likes
export const exhibitionLikes = sqliteTable(
  "exhibition_likes",
  {
    id: id(),
    exhibitionId: text("exhibition_id")
      .notNull()
      .references(() => exhibitions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("exhibition_likes_unique").on(t.exhibitionId, t.userId),
    index("exhibition_likes_exhibition_idx").on(t.exhibitionId),
  ],
);

// ---------------------------------------------------- exhibition_reports
export const REPORT_REASON = ["INAPPROPRIATE", "COPYRIGHT", "SPAM", "OTHER"] as const;
export type ReportReason = (typeof REPORT_REASON)[number];
export const REPORT_STATUS = ["OPEN", "RESOLVED", "DISMISSED"] as const;
export type ReportStatus = (typeof REPORT_STATUS)[number];
/** What the admin did when closing a report. */
export const REPORT_ACTION = ["NONE", "HIDE_EXHIBITION", "SUSPEND_ARTIST"] as const;
export type ReportAction = (typeof REPORT_ACTION)[number];

export const exhibitionReports = sqliteTable(
  "exhibition_reports",
  {
    id: id(),
    exhibitionId: text("exhibition_id")
      .notNull()
      .references(() => exhibitions.id, { onDelete: "cascade" }),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason", { enum: REPORT_REASON }).notNull(),
    detail: text("detail"),
    status: text("status", { enum: REPORT_STATUS }).notNull().default("OPEN"),
    action: text("action", { enum: REPORT_ACTION }),
    resolutionNote: text("resolution_note"),
    resolvedById: text("resolved_by_id").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("exhibition_reports_exhibition_idx").on(t.exhibitionId, t.status),
    index("exhibition_reports_status_idx").on(t.status, t.createdAt),
  ],
);

// --------------------------------------------------------------- images
/** Uploaded cover images, stored in the DB so deploys without a disk still work. */
export const images = sqliteTable("images", {
  id: id(),
  ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
  mimeType: text("mime_type").notNull(),
  bytes: blob("bytes", { mode: "buffer" }).notNull(),
  size: integer("size").notNull(),
  width: integer("width"),
  height: integer("height"),
  createdAt: createdAt(),
});

// ------------------------------------------------------------ relations
export const usersRelations = relations(users, ({ many }) => ({
  archives: many(archives),
  exhibitions: many(exhibitions),
  likes: many(exhibitionLikes),
  reports: many(exhibitionReports, { relationName: "reporter" }),
}));

export const exhibitionsRelations = relations(exhibitions, ({ many, one }) => ({
  owner: one(users, { fields: [exhibitions.ownerId], references: [users.id] }),
  guideSentences: many(guideSentences),
  audioConfig: one(audioConfigurations, {
    fields: [exhibitions.id],
    references: [audioConfigurations.exhibitionId],
  }),
  archives: many(archives),
  likes: many(exhibitionLikes),
  reports: many(exhibitionReports),
}));

export const exhibitionLikesRelations = relations(exhibitionLikes, ({ one }) => ({
  exhibition: one(exhibitions, {
    fields: [exhibitionLikes.exhibitionId],
    references: [exhibitions.id],
  }),
  user: one(users, { fields: [exhibitionLikes.userId], references: [users.id] }),
}));

export const exhibitionReportsRelations = relations(exhibitionReports, ({ one }) => ({
  exhibition: one(exhibitions, {
    fields: [exhibitionReports.exhibitionId],
    references: [exhibitions.id],
  }),
  reporter: one(users, {
    fields: [exhibitionReports.reporterId],
    references: [users.id],
    relationName: "reporter",
  }),
  resolvedBy: one(users, {
    fields: [exhibitionReports.resolvedById],
    references: [users.id],
    relationName: "resolver",
  }),
}));

export const guideSentencesRelations = relations(guideSentences, ({ one }) => ({
  exhibition: one(exhibitions, {
    fields: [guideSentences.exhibitionId],
    references: [exhibitions.id],
  }),
}));

export const audioConfigurationsRelations = relations(audioConfigurations, ({ one }) => ({
  exhibition: one(exhibitions, {
    fields: [audioConfigurations.exhibitionId],
    references: [exhibitions.id],
  }),
}));

export const archivesRelations = relations(archives, ({ one, many }) => ({
  user: one(users, { fields: [archives.userId], references: [users.id] }),
  exhibition: one(exhibitions, {
    fields: [archives.exhibitionId],
    references: [exhibitions.id],
  }),
  scraps: many(scraps),
  journal: one(journals, { fields: [archives.id], references: [journals.archiveId] }),
  keepsakes: many(digitalKeepsakes),
}));

export const scrapsRelations = relations(scraps, ({ one }) => ({
  archive: one(archives, { fields: [scraps.archiveId], references: [archives.id] }),
  guideSentence: one(guideSentences, {
    fields: [scraps.guideSentenceId],
    references: [guideSentences.id],
  }),
}));

export const journalsRelations = relations(journals, ({ one }) => ({
  archive: one(archives, { fields: [journals.archiveId], references: [archives.id] }),
}));

export const digitalKeepsakesRelations = relations(digitalKeepsakes, ({ one }) => ({
  archive: one(archives, {
    fields: [digitalKeepsakes.archiveId],
    references: [archives.id],
  }),
}));

// ----------------------------------------------------------- row types
export type User = typeof users.$inferSelect;
export type Exhibition = typeof exhibitions.$inferSelect;
export type GuideSentence = typeof guideSentences.$inferSelect;
export type AudioConfiguration = typeof audioConfigurations.$inferSelect;
export type Archive = typeof archives.$inferSelect;
export type Scrap = typeof scraps.$inferSelect;
export type Journal = typeof journals.$inferSelect;
export type DigitalKeepsake = typeof digitalKeepsakes.$inferSelect;
export type ExhibitionLike = typeof exhibitionLikes.$inferSelect;
export type ExhibitionReport = typeof exhibitionReports.$inferSelect;
export type ImageRow = typeof images.$inferSelect;

/** Re-exported so callers can build raw expressions without importing drizzle-orm. */
export { sql };
