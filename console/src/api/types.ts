// Shapes the console screens need from the backend. The server side is SPEC §9 (console.*), and
// src/api/trpc.ts maps its rows to these shapes. See API.md.

export type ISODate = string; // "2026-03-20"
export type ISODateTime = string; // "2026-11-05T10:42:00Z"

export interface Workspace {
  institutionName: string; // "MMCA Seoul"
  institutionId: string; // "STL-MMCA-0002", issued by STILL platform admin; staff type it to sign in
}

// SPEC §10.3 exhibitions.state: UNPUBLISHED is a guide taken offline after it was published.
export type PublicationStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED";

export interface Exhibition {
  id: string;
  code: string; // URL slug: still.art/e/{code}
  title: string; // "Damien Hirst"
  subtitle: string | null; // "Life, Death & Everything in Between"
  venueName: string;
  /** The venue's city, with the name where the exhibition is held ("Demo Hall, Seoul"); empty without a venue. */
  venueCity: string;
  /** The venue row the name comes from (SPEC §10.9 draft.venueId); null while none is chosen. */
  venueId: string | null;
  startDate: ISODate | null;
  endDate: ISODate | null;
  status: PublicationStatus;
  /** When the guide last went live; null until it is published. */
  publishedAt: ISODateTime | null;
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

/** An image of the exhibition (SPEC §10.3 images) the editor can place in a document. */
export interface ExhibitionImage {
  id: string;
  altText: string | null;
  /** The uploaded file the image was found in (an uploaded picture is its own document). */
  documentId?: string | null;
  /** Where the console shows the picture, published or not; null when the image has no file. */
  url: string | null;
}

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
  /** When this version was approved; any content edit sends it back to review and clears it (SPEC §10.8). */
  approvedAt: ISODateTime | null;
  /** From an open DUPLICATE_CONTENT suggestion: the item this one looks like a copy of. null = no match, or the suggestion was dismissed. */
  duplicateOf: string | null;
  /** Images and other media extracted with this item, each with its own rights record. */
  assets: MediaAsset[];
  /** Server revision the item was read at; every write sends it (SPEC §10.8). Absent in the mock. */
  revision?: string;
  /** The server wants a person to look at it (NEEDS_REVIEW): approvable one by one, never in bulk. */
  needsReview?: boolean;
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
  value: string; // "31 / 31", "Ready", "Warning", "Needs check"
  /** Passed with nothing to look at. */
  ok: boolean;
  /** Failed in a way that stops publication. A warning is neither ok nor blocking. */
  blocks: boolean;
}

/** console.preview.get: the publication checks and where the console shows each image the documents place. */
export interface PreviewData {
  checks: PublicationCheck[];
  /** By image id, published or not (an image from a document is served by GET /api/console/images/{id}); an image with no file has no entry. */
  imageUrls: Record<string, string>;
  /** The draft as the visitor renderer takes it; none in mock mode. */
  visitor: VisitorDraft | null;
}

/**
 * The draft in the visitor's shapes (console.preview.get): the exhibition as exhibition.get serves it, the guide
 * document as guide.get does (approved items only), and the images both refer to, by id.
 */
export interface VisitorDraft {
  exhibition: { description: StillDoc | null } & Record<string, unknown>;
  guide: StillDoc | null;
  images: Record<string, { url: string | null; altText: string | null; width: number; height: number }>;
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
  venueId: string | null;
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
  /** Signed in with a temporary password: the server refuses everything but changePassword and signOut (SPEC §10.5). */
  mustChangePassword: boolean;
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
export type NewExhibition = { title: string; code: string };

/** An edit suggestion (SPEC §9.4 편집 제안). `contentId` is null for exhibition-wide ones; `revision` is the item's, for the decision. */
export interface EditSuggestion {
  id: string;
  contentId: string | null;
  kind: string;
  /** The block the suggestion points at, when it has one. */
  node: string | null;
  status: "OPEN" | "ACCEPTED" | "DISMISSED";
  proposalText: string | null;
  rationale: string | null;
  revision: string | null;
}

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
  /** A new DRAFT. `code` is the exhibition's permanent id in visitor URLs; a taken one fails with appCode CODE_TAKEN. */
  createExhibition(input: NewExhibition): Promise<Exhibition>;
  /** Removes a DRAFT or unpublished exhibition nobody has saved; refused for live ones and ones with visitor archives. */
  deleteExhibition(id: string): Promise<void>;
  updateExhibition(id: string, patch: Partial<PublicationDetails>): Promise<Exhibition>;
  publishExhibition(id: string): Promise<Exhibition>;
  /** Takes a live guide offline. */
  unpublishExhibition(id: string): Promise<Exhibition>;

  listFiles(exhibitionId: string): Promise<SourceFile[]>;
  uploadFile(exhibitionId: string, file: File, options?: UploadOptions): Promise<SourceFile>;
  /** Stores a picture placed in the editor as an image of the exhibition (a file of its own, rights unconfirmed) and returns that image. */
  uploadPicture(exhibitionId: string, file: File): Promise<ExhibitionImage>;
  deleteFile(exhibitionId: string, fileId: string): Promise<void>;
  /** A short-lived URL for the original file as it was uploaded. */
  getFileDownloadUrl(fileId: string): Promise<string>;
  startAnalysis(exhibitionId: string): Promise<void>;
  listProcessingEvents(exhibitionId: string): Promise<ProcessingEvent[]>;

  listImages(exhibitionId: string): Promise<ExhibitionImage[]>;
  listContentItems(exhibitionId: string): Promise<ContentItem[]>;
  /** Another exhibition's items, read only: unlike listContentItems it leaves the editor's loaded items alone. */
  peekContentItems(exhibitionId: string): Promise<ContentItem[]>;
  updateContentItem(itemId: string, patch: ContentItemPatch): Promise<ContentItem>;
  /** The item's document (Tiptap JSON, SPEC §9.4 schema) as last loaded. */
  getContentDoc(itemId: string): unknown;
  /** Autosave of the editor: replaces the whole document and returns the item (an approved one goes back to review). REVISION_MISMATCH reads as "changed elsewhere". */
  saveContentDoc(itemId: string, doc: unknown): Promise<ContentItem>;
  /** A new artwork written by a person, not drafted from files (SPEC §9.4: the console creates items itself). */
  createArtwork(exhibitionId: string, doc: unknown): Promise<ContentItem>;
  /** The text blocks of an item with the source text each is traced to (`sourceText` is null without a source entry). */
  listBlockSources(itemId: string): Promise<BlockSource[]>;
  /** Rewrites one block to its source text (no scrap marks) and saves. */
  revertBlockToSource(itemId: string, nodeId: string): Promise<ContentItem>;
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

  listSuggestions(exhibitionId: string): Promise<EditSuggestion[]>;
  /** Accepting applies the proposal text to its node. A stale revision throws REVISION_MISMATCH. */
  /** `exhibitionId` (the code) names the exhibition of an exhibition-wide suggestion. */
  decideSuggestion(suggestion: EditSuggestion, status: "ACCEPTED" | "DISMISSED", exhibitionId?: string): Promise<void>;

  getPreview(exhibitionId: string): Promise<PreviewData>;

  getGuide(exhibitionId: string): Promise<Guide>;
  saveGuide(exhibitionId: string, sections: GuideSection[]): Promise<Guide>;
  publishGuide(exhibitionId: string): Promise<Guide>;
}

/** One top-level text block of a content item (SPEC §9.4 원문 대조 표시). */
export interface BlockSource {
  nodeId: string;
  text: string;
  sourceText: string | null;
}
