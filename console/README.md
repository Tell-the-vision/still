# STILL Console — Museum Workspace (draft)

Staff-only web app for museum curators: upload exhibition materials, review extracted content, build the visitor guide and publish it.
Visitors never use it.

**Status: front-end draft.** The screens are done; the server endpoints they call (`console.*`) do not exist yet. See [API.md](./API.md).

## How it sits next to the visitor app

```
still.art/            → visitor app (Expo web, public/index.html)
still.art/e/:code     → visitor guide (QR target)
still.art/console/...   → this app (public/console/index.html), separate bundle
still.art/api/trpc    → one server for both; staff procedures go under console.*
```

Separation:
- Own workspace package (`@still/console`) and own Vite build. Visitor pages never load its code, and its pages never load the visitor shell (`next.config.ts` rewrites `/console/*` to `public/console/index.html` and excludes it from the visitor fallback).
- `/console` is sent with `X-Robots-Tag: noindex, nofollow` and has a robots meta tag.
- Access control must be enforced by the server (`console.*` procedures check the curator session and role). Hiding buttons in the UI is not security.

## Commands (from the repo root)

```sh
npm run console:dev     # http://localhost:5180/console/ with in-memory sample data (no server needed)
npm run console:build   # typecheck + build into public/console (run after web:export, which clears public/)
npm run build         # web:export → console:build → next build
```

From `console/`: `npm run dev:server` runs the same UI against a running still server (`npm run dev` on port 3000) through a Vite proxy.

## Data

Screens never hold data. Everything goes through `src/store.tsx` → `src/api`:

| Mode | When | Source |
|---|---|---|
| mock | `npm run console:dev` | `src/api/mock.ts` + a few placeholder records in `src/api/seed.ts`. `?seed=empty` shows every screen with no data |
| server | production build, `npm run dev:server` | `src/api/trpc.ts` → `/api/trpc/console.*` |

`VITE_API_MODE=mock|server` overrides the default.

In mock mode, `?as=curator`, `?as=reviewer` or `?as=readonly` shows the screens as that role (default: institution admin). An upload whose file name contains `fail` fails once, so the retry path can be tried.

## Screens

| Route (under /console) | Screen | Source |
|---|---|---|
| `/overview` | Exhibition workspace overview | Figma 169-186 (03) |
| `/materials` | Bulk material upload | Figma (01) |
| `/materials/review` | Extracted content review | Figma (02) |
| `/materials/preview` | Digital guide preview | Figma (04) |
| `/materials/publish` | Publication settings | Figma (05) |
| `/materials/published` | Publication complete | Figma (06) |
| `/guide` | Digital guide management | Figma (07) |
| `/exhibitions` | Published exhibitions | Figma (08) |
| `/workspace` | Museum-wide home (sidebar WORKSPACE) | not in Figma, needs design review |
| `/account` | Your account (sidebar ACCOUNT) | not in Figma, needs design review |
| `/settings` | Workspace settings: profile, venues, team, publishing defaults | not in Figma, needs design review |
| `/help` | Help & support: FAQ, contact form, guides | not in Figma, needs design review |

## Notes

- Sizes were measured from 1440-wide exports of the Figma frames, so they are close, not exact.
- Futura is the design face; the app uses Futura if installed, otherwise Jost. Text is DM Sans.
- Layout: full sidebar ≥ 1281px, narrower to 901px, drawer menu (MENU button) ≤ 900px, stacked layout and card tables ≤ 600px.
