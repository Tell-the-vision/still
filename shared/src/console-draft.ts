import { z } from "zod";

const PLAYLIST_PREFIX = {
  SPOTIFY: "https://open.spotify.com/",
  APPLE_MUSIC: "https://music.apple.com/",
} as const;

export const SECTION_KINDS = ["INTRODUCTION", "ARTIST", "THEMES", "ARTWORK_HIGHLIGHTS", "GALLERY_GUIDE", "CLOSING", "CUSTOM"] as const;

// Same provider-to-URL rule as the exhibition_playlists CHECK.
const draftPlaylist = z
  .strictObject({
    provider: z.enum(["APPLE_MUSIC", "SPOTIFY"]),
    url: z.string(),
    title: z.string(),
    description: z.string().nullable(),
  })
  .refine((p) => p.url.startsWith(PLAYLIST_PREFIX[p.provider]), { message: "playlist url does not match provider", path: ["url"] });

// Shape of exhibitions.draft v1 (SPEC §10.9). Cross-row rules (approved contents, owned images) are checked on write, not here.
export const exhibitionDraft = z.strictObject({
  version: z.literal(1),
  title: z.string().min(1),
  subtitle: z.string().nullable(),
  venueId: z.uuid().nullable(),
  startDate: z.iso.date().nullable(),
  endDate: z.iso.date().nullable(),
  coverImageId: z.uuid().nullable(),
  ambienceEnabled: z.boolean(),
  playlist: draftPlaylist.nullable(),
  sections: z.array(
    z.strictObject({
      id: z.string().min(1),
      kind: z.enum(SECTION_KINDS),
      title: z.string(),
      visible: z.boolean(),
      contentIds: z.array(z.uuid()),
    }),
  ),
});
export type ExhibitionDraft = z.infer<typeof exhibitionDraft>;
