# Platform admin ↔ backend contract

The screens only talk to `PlatformApi` (`src/api/types.ts`). `src/api/trpc.ts` implements it over the still server's tRPC router (`src/server/trpc/routers/admin/*`, shared inputs in `shared/src/admin.ts`); `src/api/mock.ts` is an in-memory stand-in for `npm run dev`.

Transport: tRPC over HTTP at `/api/trpc/<procedure>`, plain JSON (no transformer), cookies included. Every call is a POST (queries too) so the browser sends `Origin`, which cookie requests must match to `STILL_ORIGIN` (SPEC §2.3). Every call sends `x-client: admin`, so the shared procedures use the STILL Admin session cookie, not a visitor or console one.

## Procedures

All `admin.*` procedures except `admin.session.create` need a STILL Admin session whose user has role `ADMIN`; otherwise `UNAUTHORIZED` (no session) or `FORBIDDEN` (wrong role). A temporary password must be changed (`password.update`) before any of them answer.

| Procedure | Kind | Input | Returns |
|---|---|---|---|
| `admin.session.create` | mutation | `{ email, password }` | staff `me` (below); sets the Admin session cookie. Wrong credentials: `UNAUTHORIZED` "Email or password is incorrect." |
| `me.get` | query | — | `{ id, displayName, email, provider, createdAt, role: "ADMIN", institution: null, mustChangePassword }` |
| `session.delete` | mutation | — | ends this session and clears the Admin cookie (sign out) |
| `password.update` | mutation | `{ currentPassword, newPassword }` | `void`. Too short: `BAD_REQUEST` `PASSWORD_TOO_WEAK`; wrong current password: `BAD_REQUEST` "The current password is incorrect." |
| `admin.institution.list` | query | `{ q?, status?: "ACTIVE" \| "PENDING_SETUP" \| "SUSPENDED", cursor?, limit? (1–50, default 20) }` | `{ items: InstitutionRow[], nextCursor: string \| null, counts: { total, active, pendingSetup, suspended } }`, newest first |
| `admin.institution.get` | query | `{ id }` | `InstitutionRow`; `NOT_FOUND` |
| `admin.institution.create` | mutation | `{ code, name, status?, analysisDailyTokenLimit? }` | `InstitutionRow`. Bad code: `BAD_REQUEST` `CODE_INVALID`; taken: `CONFLICT` `CODE_TAKEN` |
| `admin.institution.update` | mutation | `{ id, name?, status?: "ACTIVE" \| "SUSPENDED", analysisDailyTokenLimit? }` | `InstitutionRow`; suspending deletes every session of the institution's users |
| `admin.account.list` | query | `{ role?: "INSTITUTION" \| "ADMIN", institutionId? }` | `AccountRow[]`, oldest first |
| `admin.account.create` | mutation | `{ role: "INSTITUTION", institutionId, email, displayName }` or `{ role: "ADMIN", email, displayName }` | `{ account: AccountRow, temporaryPassword }`. Email in use: `CONFLICT` `LOGIN_ID_TAKEN` |
| `admin.account.update` | mutation | `{ id, status?, displayName?, resetPassword?: true }` | `{ account: AccountRow, temporaryPassword: string \| null }`; suspending or resetting ends that account's sessions. Last active operator: `CONFLICT` `LAST_ADMIN` |
| `admin.account.delete` | mutation | `{ id }` | `void`. Last active operator: `CONFLICT` `LAST_ADMIN` |

`InstitutionRow` (`src/server/services/admin/institution-rows.ts`): `{ id, code, name, status, displayStatus, accountCount, workspaceAdmin: { accountId, email } | null, lastActiveAt, analysisDailyTokenLimit, createdAt }`.
`AccountRow` (`src/server/services/admin/account-rows.ts`): `{ id, role, institution: { id, code, name } | null, email, displayName, status, mustChangePassword, lockedUntil, lastLoginAt, createdAt }`.

A temporary password appears only in the response that issued it; the app shows it once.

## How the app uses them

- **Sign in**: `/admin/sign-in` (temporary screen) posts email and password to `admin.session.create`. An `UNAUTHORIZED` from any call sends the app back there.
- **Institution ID**: `STL-<CODE>-<NNNN>`. The app takes a 2–6 letter short code (A–Z) and picks the next platform-wide number; if that ID is taken (`CODE_TAKEN`) it tries the next number, up to 3 times. The server itself accepts any `INSTITUTION_CODE` shape (`shared/src/admin.ts`).
- **Add institution** is two calls: `admin.institution.create`, then `admin.account.create` (role `INSTITUTION`) for its workspace admin. If the second fails, the institution exists without an account and the dialog offers to issue it again.
- **Reset workspace admin password**: the institution's first account from `admin.account.list({ institutionId })`, then `admin.account.update({ id, resetPassword: true })`.
- **Errors**: `src/api/trpc.ts` turns `appCode`s and Zod input errors into plain English before a screen shows them.
