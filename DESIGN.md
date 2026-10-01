# Design

The site follows the category standard for developer tools on purpose (the owner's choice,
2026-10-01): a short claim, one action, and large captures of the real app on quiet panels. It
sits beside Cursor's and Zed's sites. Nothing decorative; the app is the picture.

## Colour

Tokens live in `src/styles/global.css` as shadcn variables and follow the visitor's colour scheme.
The dark values are the app's Oxocarbon theme.

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#f7f8f9` | `#161616` | Page |
| `card` | `#ffffff` | `#1c1c1c` | Panels that hold text |
| `stage` | `#e3e6ea` | `#0d0d0d` | Panels that hold a capture |
| `foreground` | `#161616` | `#f2f4f8` | Text, primary button |
| `muted-foreground` | `#565b62` | `#a8a8a8` | Secondary text |
| `brand` | `#6336c9` | `#be95ff` | Links, focus ring, selection. Nowhere else |
| `state-working`, `state-waiting`, `state-done` | | | Only the state legend on the home page |

One accent. Buttons are neutral (foreground on background), never the accent. Captures are always
the dark Oxocarbon app, in both schemes.

## Type

Geist for text, Geist Mono for commands, paths and code only. Weights 400 and 500; 600 for the
wordmark. Three sizes carry the page: `.display` (hero, up to 48px), `.title` (section headings, up
to 32px) and `.lede` (17px). Tracking never tighter than -0.03em. No labels above headings.

## Shape and space

Radius scale from `--radius: 10px`: controls `rounded-lg`, code blocks `rounded-xl`, panels
`rounded-2xl`. Elevation is a tint change, not a border plus a shadow; only captures cast a shadow.
Page width 1200px. Sections are separated by 160 to 224px of space, not rules.

## Captures

- Every capture sits on a `.stage` panel or inside a `card` panel, never bare on the page.
- A capture is shown close to its real size: between 0.75 and 1.05 of the app's CSS pixels. Crop a
  capture to fit a column; never shrink a whole window into one.
- Below 768px a full-window capture keeps a readable width and pans sideways inside its stage.
- Each capture has alt text that says what is on screen.

## Components

shadcn/ui (`base-nova`, Base UI, Phosphor) in `src/components/ui`. Links that look like buttons use
`buttonVariants`; the client-side templates in `src/lib/views.ts` use the same variants so the
download and extensions pages match. One label per action: the download action is always
"Download".

## Motion

- The hero tabs tour the four captures: a progress line fills under the active tab, the next
  capture arrives with a short fade from blur. Hover or focus pauses it; choosing a tab ends it.
- Hero text and the stage rise once on load. Captures below ease up as they scroll into view
  (CSS scroll-driven, where supported).
- The header gains its bottom line after the page scrolls.
- All of it is off under `prefers-reduced-motion`; nothing is hidden when motion is off.
