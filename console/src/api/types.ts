// Shapes the console screens need from the backend. The server side is SPEC §9 (console.*), and
// src/api/trpc.ts maps its rows to these shapes. See API.md.

export type ISODate = string; // "2026-03-20"
export type ISODateTime = string; // "2026-11-05T10:42:00Z"

export interface Workspace {
  institutionName: string; // "MMCA Seoul"
  institutionId: string; // "STL-MMCA-0002", issued by STILL platform admin; staff type it to sign in
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
  /** Client only: upload progress 0–100 while UPLOADING. */
  progress?: number;
}
export interface UploadOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

// Handoff 5: extracted → in_review → approved / rejected. Only APPROVED items reach the visitor guide.
export type ReviewStatus = "IN_REVIEW" | "APPROVED" | "REJECTED";
export type ContentOrigin = "SOURCE" | "AI_SUGGESTION";

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
  /** From an open DUPLICATE_CONTENT suggestion: the item this one looks like a copy of. null = no match, or the suggestion was dismissed. */
  duplicateOf: string | null;
  /** Images and other media extracted with this item, each with its own rights record. */
  assets: MediaAsset[];
}
export type ContentItemPatch = Partial<Pick<ContentItem, "text" | "theme" | "contentType" | "note">>;

// SPEC §10.7 images: rights, credit and alt text are all the console records (console.image.update).
// Uploading a file never grants publication rights; only CONFIRMED images can be published (§10.7).
export type ImageRights = "UNCONFIRMED" | "CONFIRMED" | "RESTRICTED";
export interface MediaAsset {
  id: string;
  name: string; // where the image came from, e.g. "01_Introduction.pdf · Page 6"
  rights: ImageRights;
  credit: string | null; // artwork caption or photo credit
  altText: string | null; // description for screen readers
}
export type MediaAssetPatch = Partial<Pick<MediaAsset, "rights" | "credit" | "altText">>;

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

// SPEC §10.9 draft sections. A section's opening text is its first THEME / INTRODUCTION content item.
export type SectionKind = "INTRODUCTION" | "ARTIST" | "THEMES" | "ARTWORK_HIGHLIGHTS" | "GALLERY_GUIDE" | "CLOSING" | "CUSTOM";
export interface GuideSection {
  id: string;
  kind: SectionKind;
  title: string;
  visible: boolean;
  /** Content items shown in this section, in order. Must be APPROVED when added; one item appears once in the guide. */
  contentIds: string[];
}
export interface Guide {
  sections: GuideSection[];
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

// ── Account ─────────────────────────────────────────
// Accounts are issued by STILL Admin (SPEC §9.2); people in one institution have the same permissions.
export interface Me {
  id: string;
  name: string; // display name, or the email when there is none
  email: string;
}

/** Same shape as the existing `venues` table (code, name, city). Venues are shared by all institutions. */
export interface Venue {
  id: string;
  code: string;
  name: string;
  city: string;
}

/** Staff sign-in (Figma 10). Accounts are issued by STILL Admin; no self sign-up. */
export interface SignInRequest {
  institutionId: string;
  email: string;
  password: string;
  /** Longer-lived session on this device (e.g. 30 days instead of until the browser closes). */
  remember: boolean;
}

/** The one seam between screens and backend. Swap the implementation, not the screens. */
export interface ConsoleApi {
  getWorkspace(): Promise<Workspace>;

  /** Starts a staff session (httpOnly cookie set by the server). Wrong ID, email or password all give the same error. */
  signIn(request: SignInRequest): Promise<Me>;
  /** Throws UNAUTHORIZED without a staff session; the app then shows the sign-in screen. */
  getMe(): Promise<Me>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  signOut(): Promise<void>;
  listVenues(): Promise<Venue[]>;
  createVenue(venue: Pick<Venue, "name" | "city">): Promise<Venue>;

  listExhibitions(): Promise<Exhibition[]>;
  createExhibition(): Promise<Exhibition>;
  updateExhibition(id: string, patch: Partial<PublicationDetails>): Promise<Exhibition>;
  publishExhibition(id: string): Promise<Exhibition>;
  /** Takes a live guide offline. */
  unpublishExhibition(id: string): Promise<Exhibition>;

  listFiles(exhibitionId: string): Promise<SourceFile[]>;
  uploadFile(exhibitionId: string, file: File, options?: UploadOptions): Promise<SourceFile>;
  deleteFile(exhibitionId: string, fileId: string): Promise<void>;
  startAnalysis(exhibitionId: string): Promise<void>;
  listProcessingEvents(exhibitionId: string): Promise<ProcessingEvent[]>;

  listContentItems(exhibitionId: string): Promise<ContentItem[]>;
  updateContentItem(itemId: string, patch: ContentItemPatch): Promise<ContentItem>;
  /** Server must refuse while the item has an open duplicate suggestion (`approvalBlocker`). */
  approveContentItem(itemId: string): Promise<ContentItem>;
  /** REJECTED is final (SPEC §10.8): the item leaves the guide draft and cannot come back. */
  rejectContentItem(itemId: string): Promise<ContentItem>;
  /** Back to IN_REVIEW from APPROVED. Rejected items cannot come back. */
  reopenContentItem(itemId: string): Promise<ContentItem>;
  /** "Keep both": dismisses the item's DUPLICATE_CONTENT suggestion (console.suggestion.update). */
  dismissDuplicate(itemId: string): Promise<ContentItem>;
  /** Edits one image's rights, credit or alt text; returns the parent item. */
  updateMediaAsset(itemId: string, assetId: string, patch: MediaAssetPatch): Promise<ContentItem>;

  listPublicationChecks(exhibitionId: string): Promise<PublicationCheck[]>;

  getGuide(exhibitionId: string): Promise<Guide>;
  saveGuide(exhibitionId: string, sections: GuideSection[]): Promise<Guide>;
  publishGuide(exhibitionId: string): Promise<Guide>;
}
