# STILL Platform admin (draft)

**Status: front-end draft.** STILL-internal app for managing institutions: create an institution, issue its institution ID, invite its first admin, suspend or reactivate access. The server endpoints (`platform.*`) do not exist yet. See [API.md](./API.md).

```
still.art/admin/...          → this app (public/admin/index.html), STILL staff only
still.art/institutions/...   → museum staff app (institutions/), signs in with the ID issued here
still.art/api/trpc           → one server; these procedures go under platform.*
```

- Own workspace package (`@still/admin`) and own Vite build, like `institutions/`. Visitors and museum staff never load this code.
- `/admin` is sent with `X-Robots-Tag: noindex, nofollow` and has a robots meta tag.
- Access control must be enforced by the server (`platform.*` checks a STILL staff session). Hiding the page is not security.

## Run

```sh
npm run admin:dev     # http://localhost:5190/admin/ with in-memory sample data (no server needed)
npm run admin:build   # typecheck + build into public/admin (run after web:export, which clears public/)
```

From `admin/`: `npm run dev:server` runs the same UI against a running still server (`npm run dev` on port 3000).

## Screens

| Route (under /admin) | Screen | Source |
|---|---|---|
| `/sign-in` | **Temporary** sign-in (임시): one "Continue with Google" button for STILL staff | not in Figma, temporary until designed |
| `/institutions` | Institutions: counts, search, status filter, sort, table, add, suspend/reactivate, resend invite | Figma 169-186 (09), measured from Figma |
| `/overview`, `/users`, `/audit`, `/settings` | Placeholders | sidebar items in Figma 09, not designed yet |

The mock starts signed in; add `?signedOut` (or use Sign out in the header) to see the temporary sign-in screen.

Not in Figma (needs design review): the temporary sign-in screen, the Add institution dialog, the row menu (⋯: copy ID, resend invitation, suspend/reactivate), pagination buttons, and the phone layout.

The mock has 24 institutions so the counts match the Figma cards (24 / 18 / 3 / 3); the five rows in Figma are IDs 0001–0005. Default sort is newest first, so they appear on page 3 (or search for them).
