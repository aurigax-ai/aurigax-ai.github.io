import { badgeVariants } from '../components/ui/badge'
import { buttonVariants } from '../components/ui/button'
import { type SafeHtml, html } from './html'
import { icon } from './icons'
import type { Contribution, ExtensionEntry, ExtensionOk } from './marketplace'
import { type Release, assetLabel, formatBytes, formatDate } from './release'

const SHOWN_ITEMS = 6

function contributionLine(item: Contribution): SafeHtml {
  const shown = item.items.slice(0, SHOWN_ITEMS)
  const rest = item.items.length - shown.length
  const detail = shown.join(', ') + (rest > 0 ? `, and ${rest} more` : '')
  return html`<div class="grid gap-x-4 gap-y-0.5 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
    <dt class="text-foreground">${item.label}</dt>
    <dd class="text-muted-foreground">${detail || 'Yes'}</dd>
  </div>`
}

function okCard(entry: ExtensionOk): SafeHtml {
  return html`<article class="rounded-xl border border-border bg-card p-5 md:p-7" data-extension="${entry.id}">
    <header class="flex flex-wrap items-baseline gap-x-3 gap-y-2">
      <h3 class="text-xl font-medium tracking-tight">${entry.name}</h3>
      <span class="font-mono text-sm text-muted-foreground">${entry.version}</span>
      <span class="${badgeVariants({ variant: 'secondary' })}">${entry.categoryLabel}</span>
    </header>
    ${entry.description ? html`<p class="mt-3 max-w-[70ch] leading-relaxed text-muted-foreground">${entry.description}</p>` : ''}
    <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div>
        <h4 class="text-sm font-medium">Asks for</h4>
        ${
          entry.capabilities.length > 0
            ? html`<ul class="mt-2 flex flex-wrap gap-1.5">
                ${entry.capabilities.map((cap) => html`<li class="${badgeVariants({ variant: 'outline' })} font-mono">${cap}</li>`)}
              </ul>`
            : html`<p class="mt-2 text-sm text-muted-foreground">No permissions</p>`
        }
        <p class="mt-3 text-sm text-muted-foreground">
          ${entry.runsProgram ? 'Runs a program on this computer' : 'Data only, runs no program'}
        </p>
      </div>
      <div>
        <h4 class="text-sm font-medium">Adds</h4>
        ${
          entry.contributions.length > 0
            ? html`<dl class="mt-2 grid gap-2 text-sm">${entry.contributions.map(contributionLine)}</dl>`
            : html`<p class="mt-2 text-sm text-muted-foreground">Nothing declared</p>`
        }
      </div>
    </div>
    ${
      entry.sourceUrl
        ? html`<p class="mt-6 text-sm">
            <a class="link inline-flex items-center gap-1" href="${entry.sourceUrl}" rel="noopener">
              Source of ${entry.name} ${icon('arrow-up-right', 14)}
            </a>
          </p>`
        : ''
    }
  </article>`
}

export function extensionCard(entry: ExtensionEntry): SafeHtml {
  if (entry.status === 'ok') return okCard(entry)
  return html`<article class="rounded-xl border border-dashed border-input p-5 md:p-7" data-unavailable>
    <h3 class="font-mono text-base">${entry.path}</h3>
    <p class="mt-2 text-sm text-muted-foreground">This entry is unavailable. ${entry.reason}</p>
  </article>`
}

export function extensionList(entries: ExtensionEntry[]): SafeHtml {
  if (entries.length === 0) {
    return html`<p class="rounded-xl border border-dashed border-input p-7 text-muted-foreground" data-empty>
      No extension matches. Clear the search or pick another category.
    </p>`
  }
  return html`${entries.map(extensionCard)}`
}

export function releasePanel(release: Release): SafeHtml {
  return html`<div data-release="${release.version}">
    <p class="text-muted-foreground">
      <span class="font-mono text-foreground">${release.version}</span>, published
      <time datetime="${release.publishedAt}">${formatDate(release.publishedAt)}</time>
    </p>
    ${
      release.assets.length > 0
        ? html`<ul class="mt-5 grid gap-3">
            ${release.assets.map(
              (asset) => html`<li
                class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border border-border bg-card p-4 md:p-5"
              >
                <div class="min-w-0">
                  <p class="font-medium">${assetLabel(asset)}</p>
                  <p class="mt-1 break-all font-mono text-sm text-muted-foreground">
                    ${asset.name}, ${formatBytes(asset.size)}
                  </p>
                </div>
                <a class="${buttonVariants({ size: 'xl', variant: asset.kind === 'appimage' ? 'default' : 'outline' })}" href="${asset.url}">
                  ${icon('download')} Get the ${asset.kind === 'appimage' ? 'AppImage' : asset.kind === 'tarball' ? 'tarball' : 'file'}
                </a>
              </li>`,
            )}
          </ul>`
        : html`<p class="mt-5 text-muted-foreground">This release lists no files.</p>`
    }
    <p class="mt-4 text-sm">
      <a class="link" href="${release.url}" rel="noopener">Release notes for ${release.version}</a>
    </p>
  </div>`
}
