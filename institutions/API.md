# Institutions app ↔ backend contract

The screens only talk to `InstitutionsApi` (`src/api/types.ts`). To connect the real server:

1. Add an `institutions` router to the still server (`src/server/trpc/root.ts` → `institutions: institutionsRouter`) with the procedures below.
2. Add the file upload route (tRPC carries JSON only).
3. Try it locally with `npm run dev` (server, port 3000) and `npm run dev:server` in `institutions/`. Production builds already use the server.

No screen code changes. Types, field names and inputs are in `src/api/types.ts`; the calls are in `src/api/trpc.ts`.

## Transport

- tRPC over HTTP at `/api/trpc/institutions.<name>`, no transformer (plain JSON), the same as the existing routers.
  - query: `GET /api/trpc/institutions.listFiles?input=<url-encoded JSON>`
  - mutation: `POST /api/trpc/institutions.updateContentItem` with the JSON input as the body
  - success: `{ "result": { "data": … } }`. Error: `{ "error": { "message", "data": { "code", "appCode" } } }` (the existing `errorFormatter`)
- Requests send cookies (`credentials: "include"`). Every institutions procedure except `signIn` needs a staff session and answers `UNAUTHORIZED` without one; the app then shows `/institutions/sign-in`. See [Staff sign-in](#staff-sign-in-figma-10).
- In production the app is served from the same origin (`/institutions`), so no CORS. In dev, Vite proxies `/api` to `VITE_API_PROXY` (default `http://localhost:3000`).

## Procedures

| Procedure | Kind | Input | Returns |
|---|---|---|---|
| `getWorkspace` | query | — | `Workspace` |
| `listExhibitions` | query | — | `Exhibition[]` |
| `createExhibition` | mutation | — | `Exhibition` (DRAFT) |
| `updateExhibition` | mutation | `{ id, title?, subtitle?, venueName?, startDate?, endDate?, code? }` | `Exhibition` |
| `publishExhibition` | mutation | `{ id }` | `Exhibition` (PUBLISHED) |
| `unpublishExhibition` | mutation | `{ id }` | `Exhibition` (back to DRAFT; visitors lose access). Publish permission |
| `duplicateExhibition` | mutation | `{ id }` | new DRAFT `Exhibition` with the same details and guide structure, no files or items |
| `listFiles` | query | `{ exhibitionId }` | `SourceFile[]` |
| `deleteFile` | mutation | `{ exhibitionId, fileId }` | `void` |
| `startAnalysis` | mutation | `{ exhibitionId }` | `void` |
| `listProcessingEvents` | query | `{ exhibitionId }` | `ProcessingEvent[]` |
| `listContentItems` | query | `{ exhibitionId }` | `ContentItem[]` |
| `updateContentItem` | mutation | `{ itemId, text?, theme?, contentType?, note? }` | `ContentItem` (sets `updatedBy`, `updatedAt`; keeps `originalText`) |
| `approveContentItem` | mutation | `{ itemId }` | `ContentItem` (`APPROVED`). Refuse while the item is removed or an unresolved duplicate (`approvalBlocker` in `src/rules.ts`). Image rights do **not** block approval |
| `rejectContentItem` | mutation | `{ itemId }` | `ContentItem` (`REJECTED`, left out of the guide) |
| `reopenContentItem` | mutation | `{ itemId }` | `ContentItem` (back to `IN_REVIEW`) |
| `removeContentItem` | mutation | `{ itemId }` | `ContentItem` (`removed: true`). "Delete from guide dataset": kept for Restore, never shown to visitors or counted |
| `restoreContentItem` | mutation | `{ itemId }` | `ContentItem` (`removed: false`) |
| `dismissDuplicate` | mutation | `{ itemId }` | `ContentItem` (`duplicateOf: null`, "Keep both") |
| `mergeContentItems` | mutation | `{ itemId, intoId, keep: "this" \| "into" }` | `ContentItem[]` (both). The duplicate is removed (restorable); its source and images move to `intoId` |
| `splitContentItem` | mutation | `{ itemId, at }` | `ContentItem[]` (both halves, back to IN_REVIEW). `at` is a character offset in `text`; the server renumbers `order` |
| `updateMediaAsset` | mutation | `{ itemId, assetId, creator?, copyrightHolder?, imageSource?, usagePermission?, usageScope?, expiresOn?, excluded? }` | parent `ContentItem` (sets `reviewedBy`, `reviewedAt` on the asset) |
| `listPublicationChecks` | query | `{ exhibitionId }` | `PublicationCheck[]` |
| `getGuide` | query | `{ exhibitionId }` | `Guide` |
| `saveGuide` | mutation | `{ exhibitionId, sections, themes }` | `Guide`. Each section has `itemIds` (ordered); only APPROVED items reach visitors |
| `publishGuide` | mutation | `{ exhibitionId }` | `Guide` |

### Account (Workspace settings, Help & support)

| Procedure | Kind | Input | Returns |
|---|---|---|---|
| `getWorkspaceSummary` | query | — | `WorkspaceSummary` (WORKSPACE home: attention list, activity, member count) |
| `signIn` | mutation | `{ institutionId, email, password, remember }` | `Me`, and sets the staff session cookie |
| `getMe` | query | — | `Me` |
| `updateMe` | mutation | `{ name }` | `Me` |
| `getNotificationPrefs` | query | — | `NotificationPrefs` |
| `updateNotificationPrefs` | mutation | `Partial<NotificationPrefs>` | `NotificationPrefs` |
| `signOut` | mutation | — | ends the staff session (separate from the visitor `session.*` procedures) |
| `getWorkspaceSettings` | query | — | `WorkspaceSettings` |
| `updateWorkspaceSettings` | mutation | `Partial<WorkspaceSettings>` | `WorkspaceSettings` |
| `listVenues` | query | — | `Venue[]` |
| `createVenue` | mutation | `{ code, name, city }` | `Venue` (`venues` table) |
| `listMembers` | query | — | `Member[]` |
| `inviteMember` | mutation | `{ email, role }` | `Member` (INVITED) |
| `updateMember` | mutation | `{ memberId, role?, canPublish? }` | `Member` |
| `removeMember` | mutation | `{ memberId }` | `void` |
| `sendSupportRequest` | mutation | `{ topic, exhibitionId, message }` | `{ ticketId }` |

Roles (handoff 3; the final matrix is open decision 13). The checks live in `can()` in `src/rules.ts`; the mock enforces them too, and the server must.

| Role | manageWorkspace | edit (create, upload, edit content, compose guide) | review (approve/reject, confirm rights) | publish / unpublish |
|---|---|---|---|---|
| `INSTITUTION_ADMIN` | ✓ | ✓ | ✓ | ✓ always |
| `CURATOR` (Curator / Editor) | | ✓ | | only if `canPublish` |
| `REVIEWER` (Reviewer / Approver) | | | ✓ | |
| `READ_ONLY` | | | | |

Who creates accounts: STILL operators create the institution and invite its first `INSTITUTION_ADMIN`; that admin invites everyone else. There is no self sign-up.

## Staff sign-in (Figma 10)

Decided: **institution ID + work email + password**, kept alive by a server-side session. No OAuth or social login (museum staff use work accounts STILL issues), no self sign-up.

- **Institution ID**: issued by STILL in the platform admin app (`/admin`, Figma 09), e.g. `STL-MMCA-0002`. Unique, never reused, case-insensitive on input.
- **Getting a password**: platform admin invites the institution's first `INSTITUTION_ADMIN` by email; that admin invites the others (`inviteMember`). The invite email has a one-time link (single use, expires, e.g. 72 h) where the person sets their own password. Password reset works the same way (link valid ~1 h), requested by the institution admin or STILL support. Nobody sends passwords by email or chat.
- **`signIn`** checks that the email is an `ACTIVE` member of that institution and the institution is not `SUSPENDED`. Every mismatch gives the same `UNAUTHORIZED` message ("Institution ID, email or password is incorrect."), so the form never reveals which IDs or emails exist. Rate-limit failures per account and per IP (e.g. 5 failures → 15 min wait).
- **Passwords**: stored as argon2id (or bcrypt) hashes, minimum 10 characters.
- **Session**: random token in an `httpOnly`, `Secure`, `SameSite=Lax` cookie, stored server-side so it can be revoked. Without "Remember this device" it ends when the browser closes (and after ~12 h idle); with it, 30 days. `signOut` deletes it. Suspending an institution, removing a member or resetting a password deletes their sessions.
- Later, if needed: two-step verification for `INSTITUTION_ADMIN`.

Why not tokens only: a password the person sets is what staff can realistically use day to day; the security comes from the server-side session token (`httpOnly` cookie, revocable) that the password starts, plus rate limits and one-time links for invites and resets.

Upload: `POST /api/institutions/exhibitions/:exhibitionId/files` as `multipart/form-data` with a `file` field. Returns `SourceFile`. Limit: 100 MB, PDF/DOCX/XLSX/CSV/TXT (plus `.md` as plain text), the initial formats in the developer handoff. HWP/HWPX, PPTX and web URLs are not accepted until extraction for them is validated. The server must check the type; the screen's check is only a convenience. The screen uploads two files at a time, shows progress and can cancel (XMLHttpRequest with an abort signal). A presigned-URL flow also works; only `uploadFile` in `src/api/trpc.ts` changes.

### Review fields (handoff 2.5, 4.2, 5, 6)

| Field | Set by | Meaning |
|---|---|---|
| `reviewStatus` | reviewer | `IN_REVIEW` → `APPROVED` / `REJECTED`. Only `APPROVED` reaches the guide |
| `sourceFileName`, `sourceLocation` | server | provenance: file and page/row |
| `confidence` | server | 0–1 or null. Below 0.7 is flagged and never bulk-approved |
| `origin` | server | `AI_SUGGESTION` is labelled as a suggestion, never attributed to the curator or artist |
| `originalText`, `updatedBy`, `updatedAt` | server | extracted value and last editor. A full `ContentRevision` history is still to do |
| `removed` | curator (`removeContentItem` / `restoreContentItem`) | deleted from the guide dataset, excluded from counts, checks and the guide |
| `duplicateOf` | server (on extraction), curator clears it with `dismissDuplicate` | id of the item this looks like a copy of |
| `assets[]` | server creates, curator/reviewer fill in (`updateMediaAsset`) | one rights record per image: creator, copyright holder, source, permission, scope, expiry, `excluded` |

Publishing is blocked (`publishExhibition` must refuse) when the caller cannot publish, no item is approved, or an image in approved content has no confirmed rights and is not `excluded` (`blockingAssets` in `src/rules.ts`).

`SourceFile.status`: `UPLOADING` → `UPLOADED` → `PROCESSING` → `PROCESSED` / `FAILED`, with `error` saying why.

## Mapping to the existing DB

| App field | still DB |
|---|---|
| `Exhibition.code`, `title`, `startDate`, `endDate`, `status` | `exhibitions.code`, `title`, `start_date`, `end_date`, `status` (`DRAFT` / `PUBLISHED`) |
| `Exhibition.venueName` | `venues.name` via `exhibitions.venue_id` |
| `Workspace.institutionName` | `institutions.name` |
| `Workspace.institutionId` | new unique column on `institutions` (e.g. `public_id`), issued by platform admin |
| Library status (live / scheduled / ended / draft) | derived in the front end from `status` + dates (`src/format.ts`). Not stored |

### Questions for the backend

- `exhibitions.start_date` / `end_date` are `NOT NULL`, but a new draft has no dates yet. Allow null for DRAFT, or have `createExhibition` take dates?
- `subtitle` has no column. Add one, or keep it inside `description` (jsonb)?
- New tables needed: source files, extracted content items, processing events, guide sections and theme cards (or a structure inside `exhibitions.guide` jsonb).
- Account: workspace members and roles (linked to `institutions`), password hashes, staff sessions (separate from visitor sessions), invitations and reset links, workspace settings, support requests.
- `requireRightsConfirmation` / `allowVisitorScrap` / `ambienceDefaultOn` should be enforced by the server and the visitor app, not only shown here.
