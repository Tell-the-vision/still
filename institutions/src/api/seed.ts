// ⚠ SAMPLE DATA — only so the screens can be looked at before the backend exists.
// Not real museum data. Used by the mock adapter when VITE_MOCK_SEED is "sample" (the default).
// Open the app with ?seed=empty to see every screen with no data at all.

import type {
  ContentItem, Exhibition, Guide, MediaAsset, Me, Member, MemberRole, NotificationPrefs, ProcessingEvent, PublicationCheck, SourceFile, Venue, Workspace,
  WorkspaceSettings, WorkspaceSummary,
} from "./types";

export interface Seed {
  workspace: Workspace;
  me: Me;
  notifications: NotificationPrefs;
  activity: WorkspaceSummary["activity"];
  settings: WorkspaceSettings;
  venues: Venue[];
  members: Member[];
  exhibitions: Exhibition[];
  files: Record<string, SourceFile[]>;
  items: Record<string, ContentItem[]>;
  events: Record<string, ProcessingEvent[]>;
  checks: Record<string, PublicationCheck[]>;
  guides: Record<string, Guide>;
}

const workspace: Workspace = { institutionName: "MMCA Seoul", institutionId: "STL-MMCA-0002", role: "Curator" };
// Even an empty workspace has a signed-in user and settings.
// ?as=curator | reviewer | readonly (mock only) previews the screens with another role.
const ROLE_PREVIEW: Record<string, MemberRole> = { curator: "CURATOR", reviewer: "REVIEWER", readonly: "READ_ONLY" };
const previewRole = typeof window === "undefined" ? undefined : ROLE_PREVIEW[new URLSearchParams(window.location.search).get("as") ?? ""];
const me: Me = { id: "me", name: "Curator Name", email: "curator@museum.example", role: previewRole ?? "INSTITUTION_ADMIN", canPublish: !previewRole,
  // ?mustChange (mock only) opens the temporary-password screen after sign-in.
  mustChangePassword: typeof window !== "undefined" && new URLSearchParams(window.location.search).has("mustChange") };
const settings = (): WorkspaceSettings => ({
  institutionName: workspace.institutionName,
  guideLanguage: "ko+en",
  publishing: { requireRightsConfirmation: true, allowVisitorScrap: true, ambienceDefaultOn: false },
});
const meAsMember: Member = { id: me.id, name: me.name, email: me.email, role: me.role, canPublish: me.canPublish, status: "ACTIVE" };

const notifications = (): NotificationPrefs => ({ analysisComplete: true, reviewNeeded: true, weeklyDigest: false });

export const emptySeed = (): Seed => ({
  workspace, me: { ...me }, notifications: notifications(), activity: [], settings: settings(), venues: [], members: [meAsMember],
  exhibitions: [], files: {}, items: {}, events: {}, checks: {}, guides: {},
});

export function sampleSeed(): Seed {
  const ex = "sample-ex-1";
  return {
    workspace,
    me: { ...me },
    notifications: notifications(),
    activity: [
      { id: "a1", at: "2026-11-05T01:48:00Z", actor: "STILL", text: "Text extraction finished for Exhibition Title" },
      { id: "a2", at: "2026-11-05T01:47:00Z", actor: "Curator Name", text: "Uploaded 2 files to Exhibition Title" },
      { id: "a3", at: "2026-11-04T09:00:00Z", actor: "Editor Name", text: "Published changes to Live Exhibition" },
    ],
    settings: settings(),
    venues: [
      { id: "v1", code: "mmca-seoul", name: "MMCA Seoul", city: "Seoul" },
      { id: "v2", code: "sema-seosomun", name: "SeMA Seosomun", city: "Seoul" },
    ],
    members: [
      meAsMember,
      { id: "m2", name: "Editor Name", email: "editor@museum.example", role: "CURATOR", canPublish: false, status: "ACTIVE" },
      { id: "m4", name: "Reviewer Name", email: "reviewer@museum.example", role: "REVIEWER", canPublish: false, status: "ACTIVE" },
      { id: "m3", name: null, email: "invited@museum.example", role: "READ_ONLY", canPublish: false, status: "INVITED" },
    ],
    exhibitions: [
      {
        id: ex, code: "exhibition-title", title: "Exhibition Title", subtitle: "Exhibition subtitle",
        venueName: "MMCA Seoul", venueId: "v1", startDate: "2026-11-20", endDate: "2027-03-28", status: "DRAFT", updatedAt: new Date().toISOString(),
      },
      {
        id: "sample-ex-2", code: "live-exhibition", title: "Live Exhibition", subtitle: "Exhibition subtitle",
        venueName: "MMCA Seoul", venueId: "v1", startDate: "2026-08-27", endDate: "2027-02-09", status: "PUBLISHED", updatedAt: "2026-11-04T09:00:00Z",
      },
      {
        id: "sample-ex-3", code: "past-exhibition", title: "Past Exhibition", subtitle: "Exhibition subtitle",
        venueName: "SeMA Seosomun", venueId: "v2", startDate: "2026-05-19", endDate: "2026-10-25", status: "PUBLISHED", updatedAt: "2026-10-28T09:00:00Z",
      },
    ],
    files: {
      [ex]: [
        { id: "sf1", name: "01_Exhibition_Introduction.pdf", format: "PDF", summary: "8 pages", sizeBytes: 6.4e6, uploadedAt: "2026-11-05T01:42:00Z", status: "PROCESSED", error: null },
        { id: "sf2", name: "02_Artwork_Checklist.xlsx", format: "XLSX", summary: "54 rows", sizeBytes: 1.2e6, uploadedAt: "2026-11-05T01:43:00Z", status: "PROCESSED", error: null },
        { id: "sf3", name: "03_Press_Release.pdf", format: "PDF", summary: "4 pages", sizeBytes: 2.1e6, uploadedAt: "2026-11-05T01:44:00Z", status: "PROCESSED", error: null },
      ],
    },
    items: {
      [ex]: [
        item({
          id: "ci1", order: 1, title: "Exhibition introduction", kind: "Exhibition text", summary: "Overview · 3 paragraphs", itemCount: 3,
          reviewStatus: "APPROVED", confidence: 0.96, updatedBy: "Reviewer Name", updatedAt: "2026-11-05T02:10:00Z",
          sourceFileName: "01_Exhibition_Introduction.pdf", sourceLocation: "Exhibition introduction · Page 1", heading: "Exhibition introduction",
          fieldLabel: "Extracted paragraph 01", text: "Extracted introduction paragraph.", theme: "Overview", contentType: "Section text",
        }),
        item({
          id: "ci2", order: 2, title: "Curator statement", kind: "Curator statement", summary: "Key statement · 5 sentences", itemCount: 5,
          confidence: 0.88, sourceFileName: "01_Exhibition_Introduction.pdf", sourceLocation: "Curator statement · Page 2", heading: "Key statements",
          fieldLabel: "Extracted sentence 01", text: "끝을 마주할 때, 우리는 삶의 모양을 더 선명하게 바라본다.",
          theme: "Life & Death", contentType: "Guide sentence",
        }),
        item({
          id: "ci3", order: 3, title: "Artwork descriptions", kind: "Artwork records", summary: "Artwork records · 54", itemCount: 54,
          reviewStatus: "APPROVED", confidence: 0.99, updatedBy: "Reviewer Name", updatedAt: "2026-11-05T02:12:00Z",
          sourceFileName: "02_Artwork_Checklist.xlsx", sourceLocation: "Artwork checklist · Row 2", heading: "Artwork descriptions",
          fieldLabel: "Artwork 01 caption", text: "Artwork title, year. Medium.", theme: "Overview", contentType: "Artwork caption",
          assets: [
            asset({ id: "as3a", caption: "Artwork 01", creator: "Artist Name", copyrightHolder: "Artist Name", imageSource: "Artist studio", usagePermission: "GRANTED", usageScope: "Digital guide, exhibition period", expiresOn: "2027-03-28", reviewedBy: "Reviewer Name", reviewedAt: "2026-11-05T02:12:00Z" }),
            asset({ id: "as3b", caption: "Artwork 02", creator: "Artist Name", imageSource: "02_Artwork_Checklist.xlsx" }),
          ],
        }),
        item({
          id: "ci4", order: 4, title: "Installation views", kind: "Exhibition images", summary: "Images · 2", itemCount: 2,
          confidence: 0.81, sourceFileName: "01_Exhibition_Introduction.pdf", sourceLocation: "Installation views · Pages 6–7", heading: "Installation views",
          fieldLabel: "Image caption 01", text: "Installation view, Gallery 1.", theme: "Overview", contentType: "Artwork caption",
          assets: [
            asset({ id: "as4a", caption: "Installation view, Gallery 1", imageSource: "01_Exhibition_Introduction.pdf · Page 6" }),
            asset({ id: "as4b", caption: "Installation view, Gallery 2", imageSource: "01_Exhibition_Introduction.pdf · Page 7" }),
          ],
        }),
        item({
          id: "ci5", order: 5, title: "Press release introduction", kind: "Exhibition text", summary: "Overview · 2 paragraphs", itemCount: 2,
          confidence: 0.9, duplicateOf: "ci1", sourceFileName: "03_Press_Release.pdf", sourceLocation: "Press release · Page 1", heading: "Press release introduction",
          fieldLabel: "Extracted paragraph 01", text: "Extracted introduction paragraph, as worded in the press release.",
          theme: "Overview", contentType: "Editorial copy",
        }),
        item({
          id: "ci6", order: 6, title: "Gallery 3 — section text", kind: "Gallery / section text", summary: "Section description · 2", itemCount: 2,
          confidence: 0.52, sourceFileName: "01_Exhibition_Introduction.pdf", sourceLocation: "Gallery 3 · Pages 4–5 (split across pages)", heading: "Gallery 3",
          fieldLabel: "Extracted paragraph 01", text: "Section text that was split across two pages and may be incomplete.",
          theme: "Science & Medicine", contentType: "Section text",
        }),
        item({
          id: "ci7", order: 7, title: "Candidate guide sentences", kind: "Guide statement", summary: "Suggested · 3 sentences", itemCount: 3,
          origin: "AI_SUGGESTION", confidence: null, sourceFileName: "01_Exhibition_Introduction.pdf", sourceLocation: "Suggested from the curator statement · Page 2",
          heading: "Candidate guide sentences", fieldLabel: "Suggested sentence 01", text: "삶과 죽음 사이의 모든 것을 바라보는 시간.",
          theme: "Life & Death", contentType: "Guide sentence",
        }),
      ],
    },
    events: {
      [ex]: [
        { id: "pe1", at: "2026-11-05T01:47:00Z", title: "All source files uploaded", detail: "3 files", status: "COMPLETE" },
        { id: "pe2", at: "2026-11-05T01:48:00Z", title: "Text extraction", detail: "PDF and XLSX parsed", status: "COMPLETE" },
        { id: "pe3", at: null, title: "Curator review", detail: "Items require your attention", status: "IN_PROGRESS" },
      ],
    },
    checks: {
      [ex]: [
        { id: "pc1", title: "Content approval", detail: "All visitor-facing text approved", value: "—", ok: false },
        { id: "pc2", title: "Image permissions", detail: "Rights recorded for every image in approved content", value: "Needs check", ok: false },
        { id: "pc3", title: "Mobile layout", detail: "390 × 844 responsive preview", value: "Ready", ok: true },
      ],
    },
    guides: {
      [ex]: {
        hasUnpublishedChanges: true,
        sections: [
          { id: "gs1", kind: "INTRODUCTION", title: "Exhibition introduction", summary: "Draft · 3 blocks", visible: true, intro: "Section introduction.", itemIds: ["ci1"] },
          { id: "gs2", kind: "THEMES", title: "Themes & keywords", summary: "Draft · 2 blocks", visible: true, intro: "Themes introduction.", itemIds: ["ci2", "ci3"] },
        ],
        themes: [
          { id: "th1", name: "Life & Death", description: "끝과 시작, 유한한 생명" },
          { id: "th2", name: "Science & Medicine", description: "생명을 설명하려는 체계" },
        ],
      },
    },
  };
}

// Defaults for sample records: an in-review item from a source file, no edits, no media.
function item(fields: Partial<ContentItem> & Pick<ContentItem, "id" | "order" | "title" | "text">): ContentItem {
  return {
    kind: "", summary: "", itemCount: 1, reviewStatus: "IN_REVIEW", sourceFileName: "", sourceLocation: "", heading: fields.title,
    fieldLabel: "", originalText: fields.text, theme: "", contentType: "", note: "", confidence: null, origin: "SOURCE",
    updatedBy: null, updatedAt: null, removed: false, duplicateOf: null, assets: [],
    ...fields,
  };
}
function asset(fields: Partial<MediaAsset> & Pick<MediaAsset, "id" | "caption">): MediaAsset {
  return {
    altText: "", creator: "", copyrightHolder: "", imageSource: "", usagePermission: "UNKNOWN", usageScope: "", expiresOn: null, excluded: false,
    reviewedBy: null, reviewedAt: null,
    ...fields,
  };
}
