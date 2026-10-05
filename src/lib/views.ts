import { buttonVariants } from '../components/ui/button'
import { type SafeHtml, html } from './html'
import { icon } from './icons'
import { type Release, assetAction, assetLabel, formatBytes, formatDate } from './release'

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
                <a class="${buttonVariants({ size: 'xl', variant: asset.kind === 'dmg' || asset.kind === 'appimage' ? 'default' : 'outline' })}" href="${asset.url}">
                  ${icon('download')} ${assetAction(asset)}
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
