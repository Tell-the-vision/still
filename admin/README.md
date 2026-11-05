# STILL Platform admin (draft)

**Status: front-end draft.** STILL-internal app for managing institutions: create an institution, issue its institution ID and its workspace admin's temporary password, suspend or reactivate access, and manage operator accounts. It calls the server's `admin.*` procedures (plus the shared `me.get`, `session.delete`, `password.update`). See [API.md](./API.md).

```
still.art/admin/...          → this app (public/admin/index.html), STILL staff only
still.art/console/...        → museum staff app (console/), signs in with the ID issued here
still.art/api/trpc           → one server; this app calls admin.* (and me.get, session.delete, password.update)
```

- Own workspace package (`@still/admin`) and own Vite build, like `console/`. Visitors and museum staff never load this code.
- `/admin` is sent with `X-Robots-Tag: noindex, nofollow` and has a robots meta tag.
- Access control is enforced by the server (`admin.*` checks a STILL Admin session). Hiding the page is not security.

## Run

```sh
npm run admin:dev     # http://localhost:5190/admin/ with in-memory sample data (no server needed)
npm run admin:build   # typecheck + build into public/admin (run after web:export, which clears public/)
```

From `admin/`: `npm run dev:server` runs the same UI against a running still server (`npm run dev` on port 3000; `VITE_API_PROXY` changes the target).

Cookie calls must carry `Origin` equal to the server's `STILL_ORIGIN` (SPEC §2.3), or the server answers `FORBIDDEN`. The browser sends `Origin: http://localhost:5190`, so the dev proxy (`vite.config.ts`) rewrites `Origin` to the proxy target's origin. Set `STILL_ORIGIN` on the server to that same origin (e.g. `http://localhost:3000`). This is dev only; in production the app is served from the server's own origin.

## Screens

| Route (under /admin) | Screen | Source |
|---|---|---|
| `/sign-in` | **Temporary** sign-in (임시): email and password issued by STILL Admin (`admin.session.create`) | not in Figma, temporary until designed |
| `/change-password` | Change a temporary password before anything else (`password.update`) | not in Figma |
| `/institutions` | Institutions: counts, search, status filter, sort, table, add (shows the temporary password once), suspend/reactivate, reset the workspace admin's password | Figma 169-186 (09), measured from Figma |
| `/users` | **Temporary** Users & access: operator and institution accounts, add operator, suspend/reactivate, reset password, delete | not in Figma |
| `/overview`, `/audit`, `/settings` | Placeholders | sidebar items in Figma 09, not designed yet |

The mock starts signed in; add `?signedOut` (or use Sign out in the header) to see the temporary sign-in screen, or `?mustChange` for the change-password screen (current password `temporary`).

Not in Figma (needs design review): the temporary sign-in and change-password screens, Users & access, the Add institution dialog, the row menu (⋯: copy ID, reset password, suspend/reactivate), pagination buttons, and the phone layout.

The mock has 24 institutions so the counts match the Figma cards (24 / 18 / 3 / 3); the five rows in Figma are IDs 0001–0005. Default sort is newest first, so they appear on page 3 (or search for them).
