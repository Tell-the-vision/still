# Console app ↔ backend contract

The screens only talk to `ConsoleApi` (`src/api/types.ts`). `src/api/trpc.ts` implements it with the console procedures of SPEC §9.5 and maps their rows to the screens' shapes; `src/api/mock.ts` implements it in memory for `npm run console:dev`.

## Transport

- tRPC over HTTP at `/api/trpc/<procedure>`, no transformer (plain JSON). Every call is a `POST` (queries too), so cookie requests carry `Origin` (SPEC §2.3).
  - success: `{ "result": { "data": … } }`. Error: `{ "error": { "message", "data": { "code", "appCode" } } }`
- Requests send cookies (`credentials: "include"`) and the header `x-client: console`, which makes the shared procedures (`me.get`, `session.delete`, `password.update`) use the institution console session (issue #59).
- Every console procedure needs a console session and answers `UNAUTHORIZED` without one; the app then shows `/console/sign-in`.
- In production the app is served from the same origin (`/console`), so no CORS. In dev, Vite proxies `/api` to `VITE_API_PROXY` (default `http://localhost:3000`).
- `GET /api/console/images/{id}` (Route Handler, console session) answers an image of the session's institution with a `302` to a fresh presigned GET of its private display file (or to the public file of an image that came from no document), `private, max-age=300`. No session `401`; another institution's image or an unknown one `404`. The address never expires, so an editor left open keeps its pictures.

## Procedures

| `ConsoleApi` | SPEC procedure | Notes |
|---|---|---|
| `signIn` | `console.session.create` `{institutionCode, email, password, remember}` | same `UNAUTHORIZED` for every mismatch |
| `getMe`, `getWorkspace` | `me.get` | account name, email, institution name and code |
| `changePassword` | `password.update` `{currentPassword, newPassword}` | other sessions end |
| `signOut` | `session.delete` | |
| `listVenues`, `createVenue` | `console.venue.list`, `console.venue.create` `{name, city}` | venues are shared by all institutions |
| `listExhibitions` | `console.exhibition.list` | every page; the screens filter and sort |
| `createExhibition` | `console.exhibition.create` `{code, title}` | |
| `updateExhibition` | `console.draft.get` + `console.draft.update` | title, subtitle, venue (by id), dates are draft fields; the code is fixed at creation |
| `publishExhibition` | `console.publication.create` `{code, revision, rightsConfirmed, rightsStatementVersion}` | |
| `unpublishExhibition` | `console.publication.delete` | |
| `listFiles`, `deleteFile` | `console.document.list`, `console.document.delete` | |
| `uploadFile` | `console.document.create` → `PUT` to the presigned URL → `console.document.update {uploaded: true}` | the file goes straight to R2; the server never receives it (SPEC §9.4) |
| `uploadPicture` | `uploadFile`'s steps, then `console.documentUpload.create` + `PUT`s (`assets/a01.{ext}`, `assets/a01.display.webp`, `manifest.v1.json`) → `console.document.update {manifestKey}` → `console.image.list` | a picture placed in the editor is a document of its own with the picture as its one image; a `DUPLICATE` uses the earlier document's image and removes the copy |
| `listImages` | `console.image.list` | `url` is where the console shows the picture: `GET /api/console/images/{id}` for an image from a document (published or not), else its public URL |
| `startAnalysis`, `listProcessingEvents` | `console.analysis.create`, `console.analysis.get` | |
| `listContentItems` | `console.content.list` + `console.document.list` + `console.suggestion.list` | |
| `updateContentItem`, `approveContentItem`, `rejectContentItem` | `console.content.update` `{id, revision, …}` | `REJECTED` is final and leaves the guide draft (SPEC §10.8) |
| `reopenContentItem` | — | no SPEC transition yet; editing an approved item returns it to review |
| `dismissDuplicate` | `console.suggestion.update` `{contentId, id, status: DISMISSED, revision}` | "Keep both" dismisses the open `DUPLICATE_CONTENT` suggestion (issue #62) |
| `updateMediaAsset` | `console.image.update` `{id, rights?, credit?, altText?}` | |
| `listPublicationChecks` | `console.preview.get` | |
| `getGuide`, `saveGuide` | `console.exhibition.get`, `console.draft.update` | sections are `{id, kind, title, visible, contentIds}` (SPEC §10.9) |

What the console does not have (issues #60–#63): roles or per-person publishing rights, team management, workspace and notification settings, support requests, deleting and restoring content (rejecting is final instead), merging or splitting items, section intros, summaries and theme cards, duplicating exhibitions.

## Staff sign-in (Figma 10)

- **Institution ID + work email + password**, kept alive by a server-side session (SPEC §9.2, §10.5). No OAuth or social login, no self sign-up.
- **Accounts** are issued by STILL Admin (`/admin`) with a temporary password shown once; the first sign-in asks for a new password. Everyone in one institution has the same permissions. Password resets also come from STILL Admin.
- Every mismatch (institution ID, email or password) gives the same `UNAUTHORIZED` message. Repeated failures lock the account for a while.

## Review rules

| Field | Meaning |
|---|---|
| `reviewStatus` | `IN_REVIEW` (SPEC `READY` / `NEEDS_REVIEW`) → `APPROVED` / `REJECTED`. Only `APPROVED` reaches the guide; `REJECTED` is final |
| `duplicateOf` | from an open `DUPLICATE_CONTENT` suggestion: the item this one looks like a copy of |
| `assets[]` | one record per image: `rights` (`UNCONFIRMED` / `CONFIRMED` / `RESTRICTED`), `credit`, `altText` |

Publishing is blocked when no item is approved or an image in approved content is not `CONFIRMED` (`blockingAssets` in `src/rules.ts`; the server's checks are `console.preview.get`).
