// ⚠ SAMPLE DATA — only so the screens can be looked at before the backend exists.
// The institution and exhibitions are placeholders; the artworks are real Open Access records from The Met
// (openAccessArtworks.ts, CC0), shown with their published label facts only. Used by the mock adapter when
// VITE_MOCK_SEED is "sample" (the default).
// Open the app with ?seed=empty to see every screen with no data at all.

import { OPEN_ACCESS_ARTWORKS, type OpenAccessArtwork } from "./openAccessArtworks";
import type { ContentItem, Exhibition, Guide, MediaAsset, Me, ProcessingEvent, PublicationCheck, SourceFile, Venue, Workspace } from "./types";

export interface Seed {
  workspace: Workspace;
  me: Me;
  /** Accounts that can sign in to this workspace (mock only; STILL Admin issues them). */
  accounts: string[];
  password: string;
  venues: Venue[];
  exhibitions: Exhibition[];
  files: Record<string, SourceFile[]>;
  items: Record<string, ContentItem[]>;
  events: Record<string, ProcessingEvent[]>;
  checks: Record<string, PublicationCheck[]>;
  guides: Record<string, Guide>;
}

const workspace: Workspace = { institutionName: "MMCA Seoul", institutionId: "STL-MMCA-0002" };
// Even an empty workspace has a signed-in account.
const me: Me = { id: "me", name: "Curator Name", email: "curator@museum.example",
  // ?mustChange (mock only) opens the temporary-password screen after sign-in.
  mustChangePassword: typeof window !== "undefined" && new URLSearchParams(window.location.search).has("mustChange") };
const accounts = [me.email, "editor@museum.example"];

export const emptySeed = (): Seed => ({
  workspace, me: { ...me }, accounts, password: "", venues: [],
  exhibitions: [], files: {}, items: {}, events: {}, checks: {}, guides: {},
});

export function sampleSeed(): Seed {
  const ex = "sample-ex-1";
  return {
    workspace,
    me: { ...me },
    accounts,
    password: "",
    venues: [
      { id: "v1", code: "mmca-seoul", name: "MMCA Seoul", city: "Seoul" },
      { id: "v2", code: "sema-seosomun", name: "SeMA Seosomun", city: "Seoul" },
    ],
    exhibitions: [
      {
        id: ex, code: "painting-modern-life", title: "Painting Modern Life, 1865–1892", subtitle: "Manet, Degas, Renoir and van Gogh",
        venueName: "MMCA Seoul", venueCity: "Seoul", venueId: "v1", startDate: "2026-11-20", endDate: "2027-03-28", status: "DRAFT", publishedAt: null, updatedAt: new Date().toISOString(),
      },
      {
        id: "sample-ex-2", code: "turner-venice", title: "Turner's Venice", subtitle: "Light on water",
        venueName: "MMCA Seoul", venueCity: "Seoul", venueId: "v1", startDate: "2026-08-27", endDate: "2027-02-09", status: "PUBLISHED", publishedAt: "2026-11-04T09:00:00Z", updatedAt: "2026-11-04T09:00:00Z",
      },
      {
        id: "sample-ex-3", code: "bruegel-harvest", title: "Bruegel's Harvest", subtitle: "Seasons of labour",
        venueName: "SeMA Seosomun", venueCity: "Seoul", venueId: "v2", startDate: "2026-05-19", endDate: "2026-10-25", status: "PUBLISHED", publishedAt: "2026-10-28T09:00:00Z", updatedAt: "2026-10-28T09:00:00Z",
      },
    ],
    files: {
      [ex]: [
        { id: "sf1", name: "Painting_Modern_Life_checklist.xlsx", format: "XLSX", summary: `${OPEN_ACCESS_ARTWORKS.length} rows`, sizeBytes: 0.4e6, uploadedAt: "2026-11-05T01:42:00Z", status: "PROCESSED", error: null },
        { id: "sf2", name: "Met_open_access_images.zip", format: "ZIP", summary: `${OPEN_ACCESS_ARTWORKS.length} images`, sizeBytes: 24.8e6, uploadedAt: "2026-11-05T01:43:00Z", status: "PROCESSED", error: null },
      ],
    },
    items: {
      // One artwork per row of the checklist; a few already approved, one image whose rights are not confirmed yet.
      [ex]: OPEN_ACCESS_ARTWORKS.map((work, n) => artworkItem(work, n, n < 3 ? "APPROVED" : "IN_REVIEW", n === 4 ? "UNCONFIRMED" : "CONFIRMED")),
    },
    events: {
      [ex]: [
        { id: "pe1", at: "2026-11-05T01:47:00Z", title: "All source files uploaded", detail: "2 files", status: "COMPLETE" },
        { id: "pe2", at: "2026-11-05T01:48:00Z", title: "Text extraction", detail: "XLSX and images read", status: "COMPLETE" },
        { id: "pe3", at: null, title: "Curator review", detail: "Items require your attention", status: "IN_PROGRESS" },
      ],
    },
    checks: {
      [ex]: [
        { id: "pc1", title: "Content approval", detail: "All visitor-facing text approved", value: "—", ok: false, blocks: true },
        { id: "pc2", title: "Image permissions", detail: "Rights recorded for every image in approved content", value: "Needs check", ok: false, blocks: true },
        { id: "pc3", title: "Mobile layout", detail: "390 × 844 responsive preview", value: "Ready", ok: true, blocks: false },
      ],
    },
    guides: {
      [ex]: {
        hasUnpublishedChanges: true,
        sections: [
          { id: "gs1", kind: "ARTWORK_HIGHLIGHTS", title: "Artworks", visible: true, contentIds: OPEN_ACCESS_ARTWORKS.map((w) => w.id) },
        ],
      },
    },
  };
}

// An artwork as an item: its label facts in order, the image under the title, exactly as the museum publishes them.
function artworkItem(work: OpenAccessArtwork, n: number, reviewStatus: ContentItem["reviewStatus"], rights: MediaAsset["rights"]): ContentItem {
  const lines = [`${work.artist} (${work.bio})`, `${work.date} · ${work.medium} · ${work.dimensions}`, work.credit];
  const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
  return item({
    id: work.id, order: n + 1, title: work.title, kind: "Artwork", summary: `${work.artist} · ${work.date}`,
    reviewStatus, confidence: 0.97, sourceFileName: "Painting_Modern_Life_checklist.xlsx", sourceLocation: `Checklist · Row ${n + 2}`,
    heading: work.title, fieldLabel: "Artwork label", text: lines.join("\n\n"), contentType: "Artwork",
    updatedBy: reviewStatus === "APPROVED" ? "Curator Name" : null, updatedAt: reviewStatus === "APPROVED" ? "2026-11-05T02:10:00Z" : null,
    approvedAt: reviewStatus === "APPROVED" ? "2026-11-05T02:10:00Z" : null,
    assets: [asset({ id: `${work.id}-img`, name: `Met_open_access_images.zip · ${work.objectId}.jpg`, rights, credit: `${work.artist}, ${work.title}, ${work.date}. The Met, ${work.credit}.`, altText: work.title })],
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: work.title }] },
        { type: "image", attrs: { src: work.image, alt: work.title, width: "100%" } } as never,
        ...lines.map(paragraph),
      ],
    } as ContentItem["doc"],
  });
}

// Defaults for sample records: an in-review item from a source file, no edits, no media.
function item(fields: Partial<ContentItem> & Pick<ContentItem, "id" | "order" | "title" | "text">): ContentItem {
  return {
    kind: "", summary: "", itemCount: 1, reviewStatus: "IN_REVIEW", sourceFileName: "", sourceLocation: "", heading: fields.title,
    fieldLabel: "", originalText: fields.text, theme: "", contentType: "", note: "", confidence: null, origin: "SOURCE",
    updatedBy: null, updatedAt: null, approvedAt: null, duplicateOf: null, assets: [],
    ...fields,
  };
}
function asset(fields: Partial<MediaAsset> & Pick<MediaAsset, "id" | "name">): MediaAsset {
  return { rights: "UNCONFIRMED", credit: null, altText: null, ...fields };
}
