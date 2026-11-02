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
export const users = sqliteTable("users", {
  id: id(),
  /** Google `sub`. Dev-login users use `dev:<email>`. */
  googleId: text("google_id").notNull().unique(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull().default(""),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------------------------------------------------------- exhibitions
export const EXHIBITION_STATUS = ["ACTIVE", "INACTIVE"] as const;
export type ExhibitionStatus = (typeof EXHIBITION_STATUS)[number];

export const exhibitions = sqliteTable("exhibitions", {
  id: id(),
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
  status: text("status", { enum: EXHIBITION_STATUS }).notNull().default("ACTIVE"),
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

// ------------------------------------------------------------ relations
export const usersRelations = relations(users, ({ many }) => ({
  archives: many(archives),
}));

export const exhibitionsRelations = relations(exhibitions, ({ many, one }) => ({
  guideSentences: many(guideSentences),
  audioConfig: one(audioConfigurations, {
    fields: [exhibitions.id],
    references: [audioConfigurations.exhibitionId],
  }),
  archives: many(archives),
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

/** Re-exported so callers can build raw expressions without importing drizzle-orm. */
export { sql };
