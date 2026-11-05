# Platform admin ↔ backend contract

The screens only talk to `PlatformApi` (`src/api/types.ts`). To connect the real server, add a `platform` router (`src/server/trpc/root.ts` → `platform: platformRouter`) with the procedures below. Transport is the same as the institutions app: tRPC over HTTP at `/api/trpc/platform.<name>`, plain JSON, cookies included.

| Procedure | Kind | Input | Returns |
|---|---|---|---|
| `getMe` | query | — | `PlatformAdmin` (`{ email, role: "SUPER_ADMIN" }`); `UNAUTHORIZED` without a STILL staff session |
| `signOut` | mutation | — | ends the STILL staff session |
| `listInstitutions` | query | — | `Institution[]` |
| `createInstitution` | mutation | `{ name, code, adminEmail }` | `Institution` (PENDING) |
| `setInstitutionStatus` | mutation | `{ id, status: "ACTIVE" \| "SUSPENDED" }` | `Institution` |
| `resendInvite` | mutation | `{ id }` | `void` |

## Sign-in (temporary)

`/admin/sign-in` is a **temporary** screen (not designed yet): one "Continue with Google" button that goes to `GET /api/auth/staff/google?returnTo=/admin/`. That route does not exist yet. It should reuse the existing Google sign-in code (`src/server/auth/google.ts`) but issue a separate STILL staff session (not a visitor session), and only for accounts that pass the checks below. Every `platform.*` call without that session answers `UNAUTHORIZED`, and the app shows the sign-in screen.

## Rules the server must enforce

- **Who can call `platform.*`**: STILL staff only, checked on every call. These are our own people, so a STILL Google Workspace sign-in (verified email in the STILL domain, plus an allow-list with role `SUPER_ADMIN`) is fine here, unlike museum staff (see `institutions/API.md`, Staff sign-in). Every change goes to the audit log (who, what, when).
- **Institution ID**: `STL-<CODE>-<NNNN>`. `CODE` is 2–6 letters chosen on create; `NNNN` is a platform-wide sequence, so an ID is unique and never reused, even after suspension. Staff type it when signing in (case-insensitive).
- **Create**: makes the institution `PENDING` and emails `adminEmail` a one-time link (single use, expires, e.g. 72 h) to set a password as its first `INSTITUTION_ADMIN`. It becomes `ACTIVE` when that link is used.
- **Suspend**: nobody from that institution can sign in, and their open sessions are deleted. Nothing is deleted; reactivating restores access (back to `PENDING` if the invite was never accepted).
- **Resend invite**: only for `PENDING`; the previous link stops working.

## Mapping to the existing DB

| App field | still DB |
|---|---|
| `Institution.name` | `institutions.name` |
| `Institution.publicId` | new unique column on `institutions` (e.g. `public_id`), shared with `Workspace.institutionId` in the institutions app |
| `status`, `adminEmail`, `lastActiveAt` | new: institution status, first admin (from members/invitations), last staff activity |
