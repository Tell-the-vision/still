import { z } from "zod";
import { codeSchema } from "./code";

// Card designs (미결정 4, interim). "still" is the house design: the picture large, the kept line under a hairline, the
// visitor's note, the title set small. The others are its variations: what leads ("reflection" the visitor's note,
// "quote" a kept line set large, "sentence" the title and the kept lines) and where the picture sits ("large" taking
// most of the card, "framed" inside the margins, "full" edge to edge, "none"); the picture is never cropped.
// "cover" is the older picture-led layout: it reads as the title and lines with a large picture.
// The web card (client/src/ui/KeepsakeCard.tsx) and the PNG (src/server/media/keepsake-png.tsx) both draw a card from
// cardBlocks() below.
export const KEEPSAKE_LEADS = ["reflection", "quote", "sentence"] as const;
export const KEEPSAKE_LAYOUTS = ["still", ...KEEPSAKE_LEADS, "cover"] as const;
export const KEEPSAKE_PICTURES = ["large", "framed", "full", "none"] as const;
export type KeepsakeLayout = (typeof KEEPSAKE_LAYOUTS)[number];
export type KeepsakePicture = (typeof KEEPSAKE_PICTURES)[number];

// A template id names both, staying one opaque string to the API (SPEC §7.1): the lead, then "/large", "/full" or
// "/none" when the picture is not framed ("sentence", "quote/none").
export const templateIdOf = (layout: KeepsakeLayout, picture: KeepsakePicture) => (picture === "framed" ? layout : `${layout}/${picture}`);
export function templateOf(templateId: string): { layout: KeepsakeLayout; picture: KeepsakePicture } {
  const [id, place] = templateId.split("/");
  const layout = (KEEPSAKE_LAYOUTS as readonly string[]).includes(id) ? (id as KeepsakeLayout) : "sentence";
  const picture = (KEEPSAKE_PICTURES as readonly string[]).includes(place) ? (place as KeepsakePicture) : "framed";
  if (layout === "cover") return { layout: "sentence", picture: picture === "framed" ? "large" : picture };
  return { layout, picture };
}
export const KEEPSAKE_TEMPLATES = KEEPSAKE_LAYOUTS.flatMap((layout) => KEEPSAKE_PICTURES.map((picture) => templateIdOf(layout, picture)));

// Interim (미결정 3·4, #12): how many kept lines a card carries, whatever leads it.
// The creator offers this many picks and the server keeps no more, so the card shows every saved pick.
export const sentenceLimit = (_templateId: string) => 3;

// The longest journal excerpt a card holds, in string length (what zod's max counts).
export const EXCERPT_MAX = 280;

// A journal paragraph cut to fit the card: its start, never splitting a character.
// Still a substring of the journal, so the server's excerpt check holds.
export function clipExcerpt(paragraph: string) {
  let clipped = "";
  for (const char of paragraph) {
    if (clipped.length + char.length > EXCERPT_MAX) break;
    clipped += char;
  }
  return clipped;
}

// A guide page (each artwork has its own, /e/{code}/{page}): the first 8 characters of its content id.
export const pageSchema = z.string().regex(/^[0-9a-f]{8}$/);
export const keepsakePageInput = z.object({ code: codeSchema, page: pageSchema });

export const keepsakeUpsertInput = z.object({
  code: codeSchema,
  page: pageSchema,
  templateId: z.string(),
  sentenceIds: z.uuid().array().max(3).optional(),
  journalExcerpt: z.string().max(EXCERPT_MAX).optional(),
});

// SPEC §7.1 defaults, shared so the server and the client preview agree. A card is one artwork's: its note is never
// taken from the journal by default (the journal holds the whole visit), only when the visitor puts it there.
export function templateDefaults(templateId: string, scraps: { sentenceId: string; content: string }[], _journalContent: string | null) {
  return { sentences: scraps.slice(0, Math.min(1, sentenceLimit(templateId))), journalExcerpt: null };
}

type CardContent = {
  title: string;
  image: unknown | null;
  sentences: { sentenceId: string; content: string }[];
  journalExcerpt: string | null;
};

// One part of a card, top to bottom above the band. Text roles: "title" the artwork's title, "titleSmall" the same set
// small under the visitor's words; "quote" a kept line set large ("quoteLong" when it is long), "note" the visitor's
// words leading the card ("noteLong" likewise), "noteAside" their words following the rest, "line" a kept line in a
// list, "lineAside" a kept line under the note, "placeholder" what the preview shows before there are any. A picture
// that is `full` runs edge to edge, and from the top edge when `first`. Every layout carries the visitor's note.
export type CardTextRole = "title" | "titleSmall" | "quote" | "quoteLong" | "note" | "noteLong" | "noteAside" | "line" | "lineAside" | "placeholder";
export type CardBlock =
  | { kind: "picture"; full: boolean; first: boolean }
  | { kind: "text"; role: CardTextRole; id: string; text: string };

// Past these lengths a quote or a note steps down a size, so it still fits beside the picture. A quote is set large
// only when it has the card nearly to itself: short with no note beside a picture, or with no picture at all.
const QUOTE_LARGE_WITH_PICTURE = 60;
const QUOTE_LARGE_ALONE = 140;
const NOTE_LONG = 120;

const quoted = (text: string) => (/^["“]/.test(text) ? text : `“${text}”`);

// The card's parts for a lead and a picture placement; the web card and the PNG draw exactly these. A large picture
// takes the room it needs and the words are set at their smaller sizes.
export function cardBlocks(card: CardContent, templateId: string, placeholder?: string): CardBlock[] {
  const { layout, picture } = templateOf(templateId);
  const compact = picture === "large";
  const withPicture = !!card.image && picture !== "none";
  const blocks: CardBlock[] = [];
  const pictureBlock = (): CardBlock[] => (withPicture ? [{ kind: "picture", full: picture === "full", first: blocks.length === 0 }] : []);
  const kept = card.sentences.slice(0, sentenceLimit(templateId));
  const note = card.journalExcerpt;
  const text = (role: CardTextRole, id: string, value: string): CardBlock => ({ kind: "text", role, id, text: value });
  const aside = (s: { sentenceId: string; content: string }) => text("lineAside", s.sentenceId, quoted(s.content));
  const titleSmall = text("titleSmall", "title", card.title);
  const empty = (): CardBlock[] => (placeholder ? [text("placeholder", "placeholder", placeholder)] : []);

  if (layout === "still") {
    // The house design: the picture takes the room; the museum's line under a hairline, then the visitor's words.
    blocks.push(...(card.image && picture !== "none" ? [{ kind: "picture", full: picture === "full", first: true } as CardBlock] : []));
    blocks.push(...kept.map((s) => text("line", s.sentenceId, quoted(s.content))), ...(note ? [text("noteAside", "note", note)] : []));
    if (!kept.length && !note) blocks.push(...empty());
    blocks.push(titleSmall);
  } else if (layout === "quote") {
    // A kept line leads, set large only when it has the card nearly to itself; the picture follows it.
    const [first, ...rest] = kept;
    const large = !compact && first && (withPicture ? first.content.length <= QUOTE_LARGE_WITH_PICTURE && !note : first.content.length <= QUOTE_LARGE_ALONE);
    if (compact) blocks.push(...pictureBlock());
    blocks.push(...(first ? [text(large ? "quote" : compact ? "line" : "quoteLong", first.sentenceId, quoted(first.content))] : empty()));
    if (!compact) blocks.push(...pictureBlock());
    blocks.push(...rest.map(aside), ...(note ? [text("noteAside", "note", note)] : []), titleSmall);
  } else if (layout === "reflection") {
    // The visitor's words lead; the lines they kept follow, the title is set small.
    blocks.push(...pictureBlock());
    if (note) blocks.push(text(compact ? "noteAside" : note.length > NOTE_LONG ? "noteLong" : "note", "note", note));
    blocks.push(...kept.map(aside));
    if (!note && !kept.length) blocks.push(...empty());
    blocks.push(titleSmall);
  } else {
    // The title and the kept lines, each under a hairline; the note follows.
    blocks.push(...pictureBlock(), compact ? titleSmall : text("title", "title", card.title));
    blocks.push(...kept.map((s) => (compact ? aside(s) : text("line", s.sentenceId, quoted(s.content)))));
    if (note) blocks.push(text("noteAside", "note", note));
    if (!kept.length && !note) blocks.push(...empty());
  }
  return blocks;
}
