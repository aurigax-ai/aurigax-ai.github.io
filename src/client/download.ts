import { type Release, parseRelease } from '../lib/release'
import { LATEST_RELEASE_API } from '../lib/site'
import { releasePanel } from '../lib/views'

const CACHE_KEY = 'ostia:latest-release:v1'
const CACHE_MS = 30 * 60 * 1000

function cached(): Release | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? 'null')
    if (!stored || typeof stored.at !== 'number' || Date.now() - stored.at > CACHE_MS) return null
    return parseRelease(stored.payload)
  } catch {
    return null
  }
}

function remember(payload: unknown): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), payload }))
  } catch {}
}

async function latest(): Promise<Release | null> {
  const fromCache = cached()
  if (fromCache) return fromCache
  const response = await fetch(LATEST_RELEASE_API, { headers: { accept: 'application/vnd.github+json' } })
  if (!response.ok) return null
  const payload: unknown = await response.json()
  const release = parseRelease(payload)
  if (release) remember(payload)
  return release
}

function setFile(kind: string, value: string): void {
  for (const node of document.querySelectorAll(`[data-file="${kind}"]`)) node.textContent = value
}

function show(release: Release): void {
  const region = document.getElementById('release')
  if (region) region.innerHTML = releasePanel(release).value
  const appImage = release.assets.find((asset) => asset.kind === 'appimage')
  const tarball = release.assets.find((asset) => asset.kind === 'tarball')
  const dmg = release.assets.find((asset) => asset.kind === 'dmg')
  if (dmg) setFile('dmg', dmg.name)
  if (appImage) setFile('appimage', appImage.name)
  if (tarball) {
    setFile('tarball', tarball.name)
    setFile('folder', tarball.name.replace(/\.tar\.gz$/, ''))
  }
}

function status(text: string): void {
  const node = document.getElementById('release-status')
  if (node) node.textContent = text
}

const hadSnapshot = document.querySelector('[data-release]') !== null

latest()
  .then((release) => {
    if (!release) throw new Error('no release')
    show(release)
    status('Read from GitHub just now.')
  })
  .catch(() => {
    status(
      hadSnapshot
        ? 'GitHub could not be reached, so this is the latest release known when this page was built. Newer ones may be on the releases page.'
        : 'GitHub could not be reached. Use the releases page below.',
    )
  })
