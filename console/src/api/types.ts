// Shapes the console screens need from the backend.
// Field names follow the existing `still` DB where a table already exists (exhibitions: code, title,
// startDate/endDate as YYYY-MM-DD, status DRAFT | PUBLISHED). Everything else is a proposal for the
// console endpoints that do not exist yet. See API.md.

export type ISODate = string; // "2026-03-20"
export type ISODateTime = string; // "2026-11-05T10:42:00Z"

export interface Workspace {
  institutionName: string; // "MMCA Seoul"
  role: string; // "Curator"
}

export type PublicationStatus = "DRAFT" | "PUBLISHED";

export interface Exhibition {
  id: string;
  code: string; // URL slug: still.art/e/{code}
  title: string; // "Damien Hirst"
  subtitle: string | null; // "Life, Death & Everything in Between"
  venueName: string;
  startDate: ISODate | null;
  endDate: ISODate | null;
  status: PublicationStatus;
  updatedAt: ISODateTime;
}

export type FileStatus = "UPLOADING" | "READY" | "FAILED";
export interface SourceFile {
  id: string;
  name: string;
  format: string; // "PDF", "DOCX", ...
  summary: string | null; // "8 pages", "54 rows" (set by the server after parsing)
  sizeBytes: number;
  uploadedAt: ISODateTime;
  status: FileStatus;
}

export interface ContentItem {
  id: string;
  order: number;
  title: string; // "Curator statement"
  kind: string; // "Curator statement", "Section text", ...
  summary: string; // "Key statement · 5 sentences"
  itemCount: number; // extracted entries in this group
  pendingCount: number; // entries still needing review; 0 = approved
  sourceFileName: string;
  sourceLocation: string; // "Curator statement · Page 2"
  heading: string; // editor title
  fieldLabel: string; // "Extracted sentence 01"
  text: string;
  theme: string;
  contentType: string;
  note: string;
}
export type ContentItemPatch = Partial<Pick<ContentItem, "text" | "theme" | "contentType" | "note">>;

export type EventStatus = "COMPLETE" | "IN_PROGRESS" | "PENDING" | "FAILED";
export interface ProcessingEvent {
  id: string;
  at: ISODateTime | null;
  title: string;
  detail: string;
  status: EventStatus;
}

export interface PublicationCheck {
  id: string;
  title: string;
  detail: string;
  value: string; // "31 / 31", "Ready", "Needs check"
  ok: boolean;
}

export interface GuideSection {
  id: string;
  title: string;
  summary: string; // "Published · 3 blocks"
  visible: boolean;
  intro: string;
}
export interface ThemeCard {
  id: string;
  name: string;
  description: string;
}
export interface Guide {
  sections: GuideSection[];
  themes: ThemeCard[];
  hasUnpublishedChanges: boolean;
}

export interface PublicationDetails {
  title: string;
  subtitle: string | null;
  venueName: string;
  startDate: ISODate | null;
  endDate: ISODate | null;
  code: string;
}

// ── Account & workspace settings ──────────────────────
export type MemberRole = "ADMIN" | "CURATOR" | "EDITOR";

export interface Me {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
}

export interface WorkspaceSettings {
  institutionName: string;
  guideLanguage: "ko" | "en" | "ko+en";
  publishing: {
    requireRightsConfirmation: boolean; // Publish needs the rights checkbox
    allowVisitorScrap: boolean; // visitors may save guide sentences
    ambienceDefaultOn: boolean; // STILL Ambience starts on when no playlist exists
  };
}

/** Same shape as the existing `venues` table (code, name, city). */
export interface Venue {
  id: string;
  code: string;
  name: string;
  city: string;
}

export interface Member {
  id: string;
  name: string | null; // null until an invite is accepted
  email: string;
  role: MemberRole;
  status: "ACTIVE" | "INVITED";
}

export interface SupportRequest {
  topic: string;
  exhibitionId: string | null;
  message: string;
}

export interface NotificationPrefs {
  analysisComplete: boolean; // email when file analysis finishes
  reviewNeeded: boolean; // email when items are waiting for my review
  weeklyDigest: boolean; // weekly summary of the workspace
}

/** Museum-wide home (WORKSPACE). */
export interface WorkspaceSummary {
  attention: { exhibitionId: string; title: string; pendingCount: number }[];
  activity: { id: string; at: ISODateTime; actor: string; text: string }[];
  memberCount: number;
}

/** The one seam between screens and backend. Swap the implementation, not the screens. */
export interface ConsoleApi {
  getWorkspace(): Promise<Workspace>;
  getWorkspaceSummary(): Promise<WorkspaceSummary>;

  getMe(): Promise<Me>;
  updateMe(patch: Pick<Me, "name">): Promise<Me>;
  getNotificationPrefs(): Promise<NotificationPrefs>;
  updateNotificationPrefs(patch: Partial<NotificationPrefs>): Promise<NotificationPrefs>;
  signOut(): Promise<void>;
  getWorkspaceSettings(): Promise<WorkspaceSettings>;
  updateWorkspaceSettings(patch: Partial<WorkspaceSettings>): Promise<WorkspaceSettings>;
  listVenues(): Promise<Venue[]>;
  createVenue(venue: Omit<Venue, "id">): Promise<Venue>;
  listMembers(): Promise<Member[]>;
  inviteMember(email: string, role: MemberRole): Promise<Member>;
  updateMemberRole(memberId: string, role: MemberRole): Promise<Member>;
  removeMember(memberId: string): Promise<void>;
  sendSupportRequest(request: SupportRequest): Promise<{ ticketId: string }>;

  listExhibitions(): Promise<Exhibition[]>;
  createExhibition(): Promise<Exhibition>;
  updateExhibition(id: string, patch: Partial<PublicationDetails>): Promise<Exhibition>;
  publishExhibition(id: string): Promise<Exhibition>;

  listFiles(exhibitionId: string): Promise<SourceFile[]>;
  uploadFile(exhibitionId: string, file: File): Promise<SourceFile>;
  deleteFile(exhibitionId: string, fileId: string): Promise<void>;
  startAnalysis(exhibitionId: string): Promise<void>;
  listProcessingEvents(exhibitionId: string): Promise<ProcessingEvent[]>;

  listContentItems(exhibitionId: string): Promise<ContentItem[]>;
  updateContentItem(itemId: string, patch: ContentItemPatch): Promise<ContentItem>;
  approveContentItem(itemId: string): Promise<ContentItem>;

  listPublicationChecks(exhibitionId: string): Promise<PublicationCheck[]>;

  getGuide(exhibitionId: string): Promise<Guide>;
  saveGuide(exhibitionId: string, guide: Pick<Guide, "sections" | "themes">): Promise<Guide>;
  publishGuide(exhibitionId: string): Promise<Guide>;
}
