// ⚠ SAMPLE DATA — only so the screens can be looked at before the backend exists.
// Not real museum data. Used by the mock adapter when VITE_MOCK_SEED is "sample" (the default).
// Open the app with ?seed=empty to see every screen with no data at all.

import type {
  ContentItem, Exhibition, Guide, Me, Member, NotificationPrefs, ProcessingEvent, PublicationCheck, SourceFile, Venue, Workspace,
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

const workspace: Workspace = { institutionName: "MMCA Seoul", role: "Curator" };
// Even an empty workspace has a signed-in user and settings.
const me: Me = { id: "me", name: "Curator Name", email: "curator@museum.example", role: "ADMIN" };
const settings = (): WorkspaceSettings => ({
  institutionName: workspace.institutionName,
  guideLanguage: "ko+en",
  publishing: { requireRightsConfirmation: true, allowVisitorScrap: true, ambienceDefaultOn: false },
});
const meAsMember: Member = { id: me.id, name: me.name, email: me.email, role: me.role, status: "ACTIVE" };

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
      { id: "m2", name: "Editor Name", email: "editor@museum.example", role: "EDITOR", status: "ACTIVE" },
      { id: "m3", name: null, email: "invited@museum.example", role: "CURATOR", status: "INVITED" },
    ],
    exhibitions: [
      {
        id: ex, code: "exhibition-title", title: "Exhibition Title", subtitle: "Exhibition subtitle",
        venueName: "MMCA Seoul", startDate: "2026-11-20", endDate: "2027-03-28", status: "DRAFT", updatedAt: new Date().toISOString(),
      },
      {
        id: "sample-ex-2", code: "live-exhibition", title: "Live Exhibition", subtitle: "Exhibition subtitle",
        venueName: "MMCA Seoul", startDate: "2026-08-27", endDate: "2027-02-09", status: "PUBLISHED", updatedAt: "2026-11-04T09:00:00Z",
      },
      {
        id: "sample-ex-3", code: "past-exhibition", title: "Past Exhibition", subtitle: "Exhibition subtitle",
        venueName: "SeMA Seosomun", startDate: "2026-05-19", endDate: "2026-10-25", status: "PUBLISHED", updatedAt: "2026-10-28T09:00:00Z",
      },
    ],
    files: {
      [ex]: [
        { id: "sf1", name: "01_Exhibition_Introduction.pdf", format: "PDF", summary: "8 pages", sizeBytes: 6.4e6, uploadedAt: "2026-11-05T01:42:00Z", status: "READY" },
        { id: "sf2", name: "02_Artwork_Checklist.xlsx", format: "XLSX", summary: "54 rows", sizeBytes: 1.2e6, uploadedAt: "2026-11-05T01:43:00Z", status: "READY" },
      ],
    },
    items: {
      [ex]: [
        {
          id: "ci1", order: 1, title: "Exhibition introduction", kind: "Exhibition text", summary: "Overview · 3 paragraphs", itemCount: 3, pendingCount: 0,
          sourceFileName: "01_Exhibition_Introduction.pdf", sourceLocation: "Exhibition introduction · Page 1", heading: "Exhibition introduction",
          fieldLabel: "Extracted paragraph 01", text: "Extracted introduction paragraph.",
          theme: "Overview", contentType: "Section text", note: "",
        },
        {
          id: "ci2", order: 2, title: "Curator statement", kind: "Curator statement", summary: "Key statement · 5 sentences", itemCount: 5, pendingCount: 2,
          sourceFileName: "01_Exhibition_Introduction.pdf", sourceLocation: "Curator statement · Page 2", heading: "Key statements",
          fieldLabel: "Extracted sentence 01", text: "끝을 마주할 때, 우리는 삶의 모양을 더 선명하게 바라본다.",
          theme: "Life & Death", contentType: "Guide sentence", note: "",
        },
        {
          id: "ci3", order: 3, title: "Artwork descriptions", kind: "Artwork metadata", summary: "Artwork metadata · 54", itemCount: 54, pendingCount: 0,
          sourceFileName: "02_Artwork_Checklist.xlsx", sourceLocation: "Artwork checklist · Row 2", heading: "Artwork descriptions",
          fieldLabel: "Artwork 01 caption", text: "Artwork title, year. Medium.", theme: "Overview", contentType: "Artwork caption", note: "",
        },
      ],
    },
    events: {
      [ex]: [
        { id: "pe1", at: "2026-11-05T01:47:00Z", title: "All source files uploaded", detail: "2 files", status: "COMPLETE" },
        { id: "pe2", at: "2026-11-05T01:48:00Z", title: "Text extraction", detail: "PDF and XLSX parsed", status: "COMPLETE" },
        { id: "pe3", at: null, title: "Curator review", detail: "Items require your attention", status: "IN_PROGRESS" },
      ],
    },
    checks: {
      [ex]: [
        { id: "pc1", title: "Content approval", detail: "All visitor-facing text approved", value: "—", ok: false },
        { id: "pc2", title: "Image permissions", detail: "Usage scope and expiry confirmed", value: "Needs check", ok: false },
        { id: "pc3", title: "Mobile layout", detail: "390 × 844 responsive preview", value: "Ready", ok: true },
      ],
    },
    guides: {
      [ex]: {
        hasUnpublishedChanges: true,
        sections: [
          { id: "gs1", title: "Exhibition introduction", summary: "Draft · 3 blocks", visible: true, intro: "Section introduction." },
          { id: "gs2", title: "Themes & keywords", summary: "Draft · 2 blocks", visible: true, intro: "Themes introduction." },
        ],
        themes: [
          { id: "th1", name: "Life & Death", description: "끝과 시작, 유한한 생명" },
          { id: "th2", name: "Science & Medicine", description: "생명을 설명하려는 체계" },
        ],
      },
    },
  };
}
