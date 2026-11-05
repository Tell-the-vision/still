// Shapes the institutions screens need from the backend.
// Field names follow the existing `still` DB where a table already exists (exhibitions: code, title,
// startDate/endDate as YYYY-MM-DD, status DRAFT | PUBLISHED). Everything else is a proposal for the
// institutions endpoints that do not exist yet. See API.md.

export type ISODate = string; // "2026-03-20"
export type ISODateTime = string; // "2026-11-05T10:42:00Z"

export interface Workspace {
  institutionName: string; // "MMCA Seoul"
  institutionId: string; // "STL-MMCA-0002", issued by STILL platform admin; staff type it to sign in
  role: string; // "Curator"
}

// SPEC §10.3 exhibitions.state: UNPUBLISHED is a guide taken offline after it was published.
export type PublicationStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED";

export interface Exhibition {
  id: string;
  code: string; // URL slug: still.art/e/{code}
  title: string; // "Damien Hirst"
  subtitle: string | null; // "Life, Death & Everything in Between"
  venueName: string;
  /** The venue row the name comes from (SPEC §10.9 draft.venueId); null while none is chosen. */
  venueId: string | null;
  startDate: ISODate | null;
  endDate: ISODate | null;
  status: PublicationStatus;
  updatedAt: ISODateTime;
}

// Handoff 4.1 / 5: queued → uploading → uploaded → processing → processed / failed (or canceled before upload finished).
export type FileStatus = "QUEUED" | "UPLOADING" | "UPLOADED" | "PROCESSING" | "PROCESSED" | "FAILED" | "CANCELED";
export interface SourceFile {
  id: string;
  name: string;
  format: string; // "PDF", "DOCX", ...
  summary: string | null; // "8 pages", "54 rows" (set by the server after parsing)
  sizeBytes: number;
  uploadedAt: ISODateTime;
  status: FileStatus;
  error: string | null; // why it failed, shown on the row
  note?: string; // client only: something to know about a healthy row ("Text extraction for DOCX is not available yet.")
  /** Client only: upload progress 0–100 while UPLOADING. */
  progress?: number;
}
export interface UploadOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
  /** The file is stored and its text is being extracted in the browser. */
  onExtracting?: () => void;
}

// Handoff 5: extracted → in_review → approved / rejected. Only APPROVED items reach the visitor guide.
export type ReviewStatus = "IN_REVIEW" | "APPROVED" | "REJECTED";
export type ContentOrigin = "SOURCE" | "AI_SUGGESTION";

// The STILL document a content item holds (SPEC §11.8); the visitor preview renders it as is.
export type StillDoc = { type: "doc"; content: StillNode[] };
export type StillNode = {
  type: string;
  attrs?: { id?: string; level?: number; imageId?: string; display?: string; caption?: string | null };
  text?: string;
  marks?: { type: string }[];
  content?: StillNode[];
};

export interface ContentItem {
  id: string;
  order: number;
  title: string; // "Curator statement"
  kind: string; // "Curator statement", "Section text", ...
  summary: string; // "Key statement · 5 sentences"
  itemCount: number; // extracted entries in this group
  reviewStatus: ReviewStatus;
  sourceFileName: string;
  sourceLocation: string; // "Curator statement · Page 2"
  heading: string; // editor title
  fieldLabel: string; // "Extracted sentence 01"
  doc?: StillDoc; // the document behind `text`, for the visitor preview
  text: string; // current (edited) value
  originalText: string; // value as extracted; kept so edits can be compared and reverted
  theme: string;
  contentType: string;
  note: string;
  /** Extractor confidence 0–1, null when the extractor does not give one. Low confidence is flagged, never auto-approved. */
  confidence: number | null;
  /** AI_SUGGESTION = a sentence STILL proposed. Must be labelled as a suggestion, never attributed to the curator or artist. */
  origin: ContentOrigin;
  updatedBy: string | null; // last editor
  updatedAt: ISODateTime | null;
  /** Deleted from the guide dataset. Kept so it can be restored; never shown to visitors or counted. */
  removed: boolean;
  /** Set by the server when this item looks like a copy of another item. null = no match, or the curator chose to keep both. */
  duplicateOf: string | null;
  /** Images and other media extracted with this item, each with its own rights record. */
  assets: MediaAsset[];
  /** Server revision the item was read at; every write sends it (SPEC §10.8). Absent in the mock. */
  revision?: string;
  /** The server wants a person to look at it (NEEDS_REVIEW): approvable one by one, never in bulk. */
  needsReview?: boolean;
}
export type ContentItemPatch = Partial<Pick<ContentItem, "text" | "theme" | "contentType" | "note">>;

// Handoff 6 MediaAsset / RightsRecord. Uploading a file never grants publication rights.
export type UsagePermission = "UNKNOWN" | "GRANTED" | "DENIED";
export interface MediaAsset {
  id: string;
  caption: string;
  creator: string;
  copyrightHolder: string;
  imageSource: string;
  usagePermission: UsagePermission;
  usageScope: string; // "Digital guide, exhibition period"
  expiresOn: ISODate | null;
  excluded: boolean; // curator chose not to publish this asset
  reviewedBy: string | null;
  reviewedAt: ISODateTime | null;
}
export type MediaAssetPatch = Partial<Pick<MediaAsset, "creator" | "copyrightHolder" | "imageSource" | "usagePermission" | "usageScope" | "expiresOn" | "excluded">>;

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

// SPEC §10.9 draft.sections[].kind. Sections the staff add are CUSTOM.
export type SectionKind = "INTRODUCTION" | "ARTIST" | "THEMES" | "ARTWORK_HIGHLIGHTS" | "GALLERY_GUIDE" | "CLOSING" | "CUSTOM";

export interface GuideSection {
  id: string;
  kind: SectionKind;
  title: string;
  summary: string; // "Published · 3 blocks"
  visible: boolean;
  intro: string;
  /** Content items shown in this section, in order. Only APPROVED items reach visitors (handoff 4.4). */
  itemIds: string[];
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
  venueId: string | null;
  startDate: ISODate | null;
  endDate: ISODate | null;
  code: string;
}

// ── Account & workspace settings ──────────────────────
// Handoff 3. Final role matrix is an open decision (13).
export type MemberRole = "INSTITUTION_ADMIN" | "CURATOR" | "REVIEWER" | "READ_ONLY";

export interface Me {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  canPublish: boolean; // granted per person; always true for INSTITUTION_ADMIN
  /** Signed in with a temporary password: the server refuses everything but changePassword and signOut (SPEC §10.5). */
  mustChangePassword: boolean;
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
  canPublish: boolean;
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

/** Staff sign-in (Figma 10). Accounts are created by STILL (institution) and the institution admin (members); no self sign-up. */
export interface SignInRequest {
  institutionId: string;
  email: string;
  password: string;
  /** Longer-lived session on this device (e.g. 30 days instead of until the browser closes). */
  remember: boolean;
}

/** The one seam between screens and backend. Swap the implementation, not the screens. */
export type NewExhibition = { title: string; code: string };

/** An edit suggestion (SPEC §9.4 편집 제안). `contentId` is null for exhibition-wide ones; `revision` is the item's, for the decision. */
export interface EditSuggestion {
  id: string;
  contentId: string | null;
  kind: string;
  status: "OPEN" | "ACCEPTED" | "DISMISSED";
  proposalText: string | null;
  rationale: string | null;
  revision: string | null;
}

export interface InstitutionsApi {
  getWorkspace(): Promise<Workspace>;
  getWorkspaceSummary(): Promise<WorkspaceSummary>;

  /** Starts a staff session (httpOnly cookie set by the server). Wrong ID, email or password all give the same error. */
  signIn(request: SignInRequest): Promise<Me>;
  /** Throws UNAUTHORIZED without a staff session; the app then shows the sign-in screen. */
  getMe(): Promise<Me>;
  updateMe(patch: Pick<Me, "name">): Promise<Me>;
  getNotificationPrefs(): Promise<NotificationPrefs>;
  updateNotificationPrefs(patch: Partial<NotificationPrefs>): Promise<NotificationPrefs>;
  signOut(): Promise<void>;
  /** Replaces the temporary password (SPEC §9.5 password.update). Wrong current or too-short new password throws BAD_REQUEST. */
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  getWorkspaceSettings(): Promise<WorkspaceSettings>;
  updateWorkspaceSettings(patch: Partial<WorkspaceSettings>): Promise<WorkspaceSettings>;
  listVenues(): Promise<Venue[]>;
  createVenue(venue: Omit<Venue, "id">): Promise<Venue>;
  listMembers(): Promise<Member[]>;
  inviteMember(email: string, role: MemberRole): Promise<Member>;
  updateMember(memberId: string, patch: Partial<Pick<Member, "role" | "canPublish">>): Promise<Member>;
  removeMember(memberId: string): Promise<void>;
  sendSupportRequest(request: SupportRequest): Promise<{ ticketId: string }>;

  listExhibitions(): Promise<Exhibition[]>;
  /** A new DRAFT. `code` is the exhibition's permanent id in visitor URLs; a taken one fails with appCode CODE_TAKEN. */
  createExhibition(input: NewExhibition): Promise<Exhibition>;
  /** Removes a DRAFT or unpublished exhibition nobody has saved; refused for live ones and ones with visitor archives. */
  deleteExhibition(id: string): Promise<void>;
  updateExhibition(id: string, patch: Partial<PublicationDetails>): Promise<Exhibition>;
  publishExhibition(id: string): Promise<Exhibition>;
  /** Takes a live guide offline (status back to DRAFT). */
  unpublishExhibition(id: string): Promise<Exhibition>;
  /** New DRAFT exhibition with the same details and guide structure, no files. */
  duplicateExhibition(id: string): Promise<Exhibition>;

  listFiles(exhibitionId: string): Promise<SourceFile[]>;
  uploadFile(exhibitionId: string, file: File, options?: UploadOptions): Promise<SourceFile>;
  deleteFile(exhibitionId: string, fileId: string): Promise<void>;
  /** A short-lived URL for the original file as it was uploaded. */
  getFileDownloadUrl(fileId: string): Promise<string>;
  startAnalysis(exhibitionId: string): Promise<void>;
  listProcessingEvents(exhibitionId: string): Promise<ProcessingEvent[]>;

  listContentItems(exhibitionId: string): Promise<ContentItem[]>;
  updateContentItem(itemId: string, patch: ContentItemPatch): Promise<ContentItem>;
  /** The item's document (Tiptap JSON, SPEC §9.4 schema) as last loaded. */
  getContentDoc(itemId: string): unknown;
  /** Autosave of the editor: replaces the whole document. REVISION_MISMATCH reads as "changed elsewhere". */
  saveContentDoc(itemId: string, doc: unknown): Promise<void>;
  /** The text blocks of an item with the source text each is traced to (`sourceText` is null without a source entry). */
  listBlockSources(itemId: string): Promise<BlockSource[]>;
  /** Rewrites one block to its source text (no scrap marks) and saves. */
  revertBlockToSource(itemId: string, nodeId: string): Promise<ContentItem>;
  /** Server must refuse while the item is removed or an unresolved duplicate (`approvalBlocker`). */
  approveContentItem(itemId: string): Promise<ContentItem>;
  rejectContentItem(itemId: string): Promise<ContentItem>;
  /** Back to IN_REVIEW from APPROVED or REJECTED. */
  reopenContentItem(itemId: string): Promise<ContentItem>;
  /** Delete from the guide dataset (restorable). */
  removeContentItem(itemId: string): Promise<ContentItem>;
  restoreContentItem(itemId: string): Promise<ContentItem>;
  /** "Keep both": clears duplicateOf. */
  dismissDuplicate(itemId: string): Promise<ContentItem>;
  /** Merge a duplicate into the item it copies: `keep` picks whose text survives; the duplicate is removed (restorable). */
  mergeContentItems(itemId: string, intoId: string, keep: "this" | "into"): Promise<ContentItem[]>;
  /** Split one item in two at a character offset of its text. Returns both items. */
  splitContentItem(itemId: string, at: number): Promise<ContentItem[]>;
  /** Edits one asset's rights record; returns the parent item. */
  updateMediaAsset(itemId: string, assetId: string, patch: MediaAssetPatch): Promise<ContentItem>;

  listSuggestions(exhibitionId: string): Promise<EditSuggestion[]>;
  /** Accepting applies the proposal text to its node. A stale revision throws REVISION_MISMATCH. */
  decideSuggestion(suggestion: EditSuggestion, status: "ACCEPTED" | "DISMISSED"): Promise<void>;

  listPublicationChecks(exhibitionId: string): Promise<PublicationCheck[]>;

  getGuide(exhibitionId: string): Promise<Guide>;
  saveGuide(exhibitionId: string, guide: Pick<Guide, "sections" | "themes">): Promise<Guide>;
  publishGuide(exhibitionId: string): Promise<Guide>;
}

/** One top-level text block of a content item (SPEC §9.4 원문 대조 표시). */
export interface BlockSource {
  nodeId: string;
  text: string;
  sourceText: string | null;
}
