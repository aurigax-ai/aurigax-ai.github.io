# pine-website

The website for [Pine](https://github.com/aurigax-ai/pine), a terminal-first workspace for Linux.
It is a static site with two pages:

| Page | What it shows |
|---|---|
| `/` | What Pine is, with captures of the real app |
| `/download/` | The latest release, its files and sizes, and install steps |

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
| `pnpm test:smoke` | Playwright against the built site, with GitHub stubbed. Needs Chrome; set `PLAYWRIGHT_CHANNEL` to use another browser channel. Inside an agent session `astro preview` detaches and the run fails to start; unset `CLAUDECODE` for the command |
| `pnpm snapshot` | Refresh the build-time data in `src/data/` |
| `pnpm shots <folder>` | Import new app captures and cut the crops each section uses (see below) |
| `pnpm social [file]` | Render the social card to `public/og.png`, and to `file` at 1280 by 640 for a GitHub social preview |

The site is served from a sub-path. `SITE_BASE` sets it and defaults to `/pine-website`; build with
`SITE_BASE=/` to serve from the root. Internal links go through `href()` in `src/lib/paths.ts`.

Stack: Astro (static output), Tailwind CSS v4, shadcn/ui components on Base UI (the same preset the
app uses), self-hosted Geist fonts and Phosphor icons. React runs in the browser only for the hero
tabs on the home page; everything else is static HTML. There is no analytics and no third-party
script. Design rules are in `DESIGN.md`.

## How data is loaded

The download page renders without JavaScript from a snapshot saved at build time, then replaces it
with live data when JavaScript runs.

**Download** (`src/client/download.ts`) asks the GitHub REST API for
`repos/aurigax-ai/pine/releases/latest`, unauthenticated, and caches the answer in `sessionStorage`
for 30 minutes. `parseRelease` (`src/lib/release.ts`) accepts only a release whose page and file
links belong to that repository. If the call fails or is rate-limited, the page keeps the snapshot
and points at the releases page.

The snapshot lives in `src/data/*.snapshot.json`. `pnpm snapshot` rewrites it, and the Pages workflow
runs it before each build. A failed fetch keeps the committed files.

## Updating the captures

Every image on the home page is a capture of the real app, driven by Playwright in a throwaway home
folder. Nothing in them is drawn by hand. What is staged is the work: six made-up projects
(`capture/pine-shots.demo.ts`) and stand-in `claude`, `codex`, `pnpm` and `uv` programs that print
a written session and call the real `pine` command, so the states, tabs, browser pane, diff and
approval cards you see are the app's own.

1. In a checkout of the app, build it (`pnpm install && pnpm rebuild && pnpm build`).
2. Copy `capture/pine-shots.spec.ts` and `capture/pine-shots.demo.ts` into the app's `e2e/` folder.
3. Captures are taken at twice the pixel density, so run Playwright on a large virtual display:

   ```bash
   rm -rf /tmp/pine-shots /tmp/pine-shots-template
   xvfb-run -a -s '-screen 0 3200x2000x24' env -u WAYLAND_DISPLAY \
     pnpm exec playwright test e2e/pine-shots.spec.ts
   ```

   The first scene builds the workspaces once into `/tmp/pine-shots-template`; delete that folder
   after changing the projects. Captures land in `/tmp/pine-shots`. The spec uses `/tmp/home/dev`
   as the home folder and deletes `/tmp/home` first. `SHOT_THEME` picks the app theme (default
   `oxocarbon`).
4. Back here, run `pnpm shots /tmp/pine-shots`, then `pnpm social`. The crops are listed in
   `scripts/import-shots.mjs`, in the app's CSS pixels.
5. Look at every image before committing. They must not show a real user name, host name, home
   path, email address, token or a project of your own.

Do not commit the two capture files in the app repository.

The picture behind the hero capture (`src/assets/stage.webp`) is not a capture. Its source,
`capture/backgrounds/abstract-boughs.png`, was made with an image generator (blurred pine boughs in
mist) and `node scripts/wash.mjs <source> src/assets/stage.webp [white|color|mono]` fades it and
adds film grain. To change the look, edit the numbers at the top of that script and run it again.

## Deploy

`.github/workflows/pages.yml` builds and deploys to GitHub Pages on every push to `main`.

## Licence

This repository has no licence file. The app declares MIT in its `package.json` but ships no licence
text to mirror here.
