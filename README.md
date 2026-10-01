# pine-website

The website for [Pine](https://github.com/aurigax-ai/pine), a terminal-first workspace for Linux.
It is a static site with three pages:

| Page | What it shows |
|---|---|
| `/` | What Pine is, with screenshots of the real app |
| `/download/` | The latest release, its files and sizes, and install steps |
| `/extensions/` | The extensions in the public marketplace, read from its repository |

Live at https://aurigax-ai.github.io/pine-website/.

## Develop

Use pnpm.

```bash
pnpm install
pnpm dev          # http://localhost:4321/pine-website/
pnpm check        # typecheck, unit tests, build, smoke tests
```

| Command | What it does |
|---|---|
| `pnpm dev` | Astro dev server |
| `pnpm build` | Static build into `dist/` |
| `pnpm preview` | Serve `dist/` |
| `pnpm typecheck` | `astro check` |
| `pnpm test` | Unit tests (vitest) |
| `pnpm test:smoke` | Playwright against the built site, with GitHub stubbed. Needs Chrome; set `PLAYWRIGHT_CHANNEL` to use another browser channel |
| `pnpm snapshot` | Refresh the build-time data in `src/data/` |
| `pnpm shots <folder>` | Import new app screenshots (see below) |

The site is served from a sub-path. `SITE_BASE` sets it and defaults to `/pine-website`; build with
`SITE_BASE=/` to serve from the root. Internal links go through `href()` in `src/lib/paths.ts`.

Stack: Astro (static output, no client framework), Tailwind CSS v4, self-hosted Geist fonts,
Phosphor icons. There is no analytics and no third-party script.

## How data is loaded

Both data pages render without JavaScript from a snapshot saved at build time, then replace it with
live data when JavaScript runs.

**Download** (`src/client/download.ts`) asks the GitHub REST API for
`repos/aurigax-ai/pine/releases/latest`, unauthenticated, and caches the answer in `sessionStorage`
for 30 minutes. `parseRelease` (`src/lib/release.ts`) accepts only a release whose page and file
links belong to that repository. If the call fails or is rate-limited, the page keeps the snapshot
and points at the releases page.

**Extensions** (`src/client/extensions.ts`) reads `pine-marketplace.json` and each listed
extension's `pine.json` from `raw.githubusercontent.com/aurigax-ai/pine-extensions/main/`. If `main`
has no marketplace file it asks the API for the default branch. `src/lib/marketplace.ts` parses
defensively:

- A missing or malformed manifest becomes an "unavailable" entry; the rest still show.
- Contribution labels come from the manifest's own keys (`paneChips` becomes "Pane chips"), so a new
  kind of contribution appears without a change here.
- Every string from a manifest is escaped by the `html` template tag (`src/lib/html.ts`) and shown
  as text. Links are kept only when they are http or https.

The snapshot lives in `src/data/*.snapshot.json`. `pnpm snapshot` rewrites it, and the Pages workflow
runs it before each build. A failed fetch keeps the committed files.

## Updating the screenshots

Every image on the home page is a capture of the real app, driven by Playwright in a throwaway home
folder with a sample project called `demo-shop`. Nothing in them is drawn by hand.

1. In a checkout of the app, build it (`pnpm install && pnpm rebuild && pnpm build`).
2. Copy `capture/pine-shots.spec.ts` into the app's `e2e/` folder.
3. Captures are taken at twice the pixel density, so the virtual display must be large: in
   `scripts/e2e.sh` change the screen to `3200x2000x24` for the run.
4. Run it once per theme:

   ```bash
   SHOT_THEME=adeberry pnpm test:e2e e2e/pine-shots.spec.ts
   SHOT_THEME=pine-light pnpm test:e2e e2e/pine-shots.spec.ts
   ```

   The captures land in `/tmp/pine-shots`. The spec uses `/tmp/home/dev` as the home folder and
   deletes `/tmp/home` first.
5. Back here, run `pnpm shots /tmp/pine-shots`. It writes `src/assets/shots/` and `public/og.png`.
6. Look at every image before committing. They must not show a real user name, host name, home
   path, email address or token.

Do not commit the spec or the `e2e.sh` change in the app repository.

## Deploy

`.github/workflows/pages.yml` builds and deploys to GitHub Pages on every push to `main`.

## Licence

This repository has no licence file. The app declares MIT in its `package.json` but ships no licence
text to mirror here.
