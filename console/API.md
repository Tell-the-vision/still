# Console app ↔ backend contract

The screens only talk to `ConsoleApi` (`src/api/types.ts`). To connect the real server:

1. Add a `console` router to the still server (`src/server/trpc/root.ts` → `console: consoleRouter`) with the procedures below.
2. Add the file upload route (tRPC carries JSON only).
3. Try it locally with `npm run dev` (server, port 3000) and `npm run dev:server` in `console/`. Production builds already use the server.

No screen code changes. Types, field names and inputs are in `src/api/types.ts`; the calls are in `src/api/trpc.ts`.

## Transport

- tRPC over HTTP at `/api/trpc/console.<name>`, no transformer (plain JSON), the same as the existing routers.
  - query: `GET /api/trpc/console.listFiles?input=<url-encoded JSON>`
  - mutation: `POST /api/trpc/console.updateContentItem` with the JSON input as the body
  - success: `{ "result": { "data": … } }`. Error: `{ "error": { "message", "data": { "code", "appCode" } } }` (the existing `errorFormatter`)
- Requests send cookies (`credentials: "include"`). All console procedures need a curator session. Staff sign-in does not exist in the server yet.
- In production the app is served from the same origin (`/console`), so no CORS. In dev, Vite proxies `/api` to `VITE_API_PROXY` (default `http://localhost:3000`).

## Procedures

| Procedure | Kind | Input | Returns |
|---|---|---|---|
| `getWorkspace` | query | — | `Workspace` |
| `listExhibitions` | query | — | `Exhibition[]` |
| `createExhibition` | mutation | — | `Exhibition` (DRAFT) |
| `updateExhibition` | mutation | `{ id, title?, subtitle?, venueName?, startDate?, endDate?, code? }` | `Exhibition` |
| `publishExhibition` | mutation | `{ id }` | `Exhibition` (PUBLISHED) |
| `listFiles` | query | `{ exhibitionId }` | `SourceFile[]` |
| `deleteFile` | mutation | `{ exhibitionId, fileId }` | `void` |
| `startAnalysis` | mutation | `{ exhibitionId }` | `void` |
| `listProcessingEvents` | query | `{ exhibitionId }` | `ProcessingEvent[]` |
| `listContentItems` | query | `{ exhibitionId }` | `ContentItem[]` |
| `updateContentItem` | mutation | `{ itemId, text?, theme?, contentType?, note? }` | `ContentItem` |
| `approveContentItem` | mutation | `{ itemId }` | `ContentItem` (pendingCount 0) |
| `listPublicationChecks` | query | `{ exhibitionId }` | `PublicationCheck[]` |
| `getGuide` | query | `{ exhibitionId }` | `Guide` |
| `saveGuide` | mutation | `{ exhibitionId, sections, themes }` | `Guide` |
| `publishGuide` | mutation | `{ exhibitionId }` | `Guide` |

### Account (Workspace settings, Help & support)

| Procedure | Kind | Input | Returns |
|---|---|---|---|
| `getWorkspaceSummary` | query | — | `WorkspaceSummary` (WORKSPACE home: attention list, activity, member count) |
| `getMe` | query | — | `Me` |
| `updateMe` | mutation | `{ name }` | `Me` |
| `getNotificationPrefs` | query | — | `NotificationPrefs` |
| `updateNotificationPrefs` | mutation | `Partial<NotificationPrefs>` | `NotificationPrefs` |
| `session.delete` (existing) | mutation | — | ends the session (Sign out) |
| `getWorkspaceSettings` | query | — | `WorkspaceSettings` |
| `updateWorkspaceSettings` | mutation | `Partial<WorkspaceSettings>` | `WorkspaceSettings` |
| `listVenues` | query | — | `Venue[]` |
| `createVenue` | mutation | `{ code, name, city }` | `Venue` (`venues` table) |
| `listMembers` | query | — | `Member[]` |
| `inviteMember` | mutation | `{ email, role }` | `Member` (INVITED) |
| `updateMemberRole` | mutation | `{ memberId, role }` | `Member` |
| `removeMember` | mutation | `{ memberId }` | `void` |
| `sendSupportRequest` | mutation | `{ topic, exhibitionId, message }` | `{ ticketId }` |

Roles: `ADMIN` (settings, team, publishing), `CURATOR` (review, approve, publish), `EDITOR` (upload, edit drafts). The screens hide admin-only controls for non-admins, but the server must enforce roles too.

Upload: `POST /api/console/exhibitions/:exhibitionId/files` as `multipart/form-data` with a `file` field. Returns `SourceFile`. Limit: 100 MB, PDF/DOCX/XLSX/PPTX/TXT. A presigned-URL flow also works; only `uploadFile` in `src/api/trpc.ts` changes.

## Mapping to the existing DB

| App field | still DB |
|---|---|
| `Exhibition.code`, `title`, `startDate`, `endDate`, `status` | `exhibitions.code`, `title`, `start_date`, `end_date`, `status` (`DRAFT` / `PUBLISHED`) |
| `Exhibition.venueName` | `venues.name` via `exhibitions.venue_id` |
| `Workspace.institutionName` | `institutions.name` |
| Library status (live / scheduled / ended / draft) | derived in the front end from `status` + dates (`src/format.ts`). Not stored |

### Questions for the backend

- `exhibitions.start_date` / `end_date` are `NOT NULL`, but a new draft has no dates yet. Allow null for DRAFT, or have `createExhibition` take dates?
- `subtitle` has no column. Add one, or keep it inside `description` (jsonb)?
- New tables needed: source files, extracted content items, processing events, guide sections and theme cards (or a structure inside `exhibitions.guide` jsonb).
- Account: workspace members and roles (linked to `institutions`), invitations, workspace settings, support requests. How curators sign in (separate from visitor sign-in?) still needs a decision.
- `requireRightsConfirmation` / `allowVisitorScrap` / `ambienceDefaultOn` should be enforced by the server and the visitor app, not only shown here.
