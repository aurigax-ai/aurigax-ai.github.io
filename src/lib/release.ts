import { APP_REPO } from './site'

export interface ReleaseAsset {
  name: string
  size: number
  url: string
  kind: 'appimage' | 'tarball' | 'other'
}

export interface Release {
  tag: string
  version: string
  publishedAt: string
  url: string
  assets: ReleaseAsset[]
}

const RELEASE_PREFIX = `https://github.com/${APP_REPO}/releases/`
const TAG = /^v\d+\.\d+\.\d+$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function assetKind(name: string): ReleaseAsset['kind'] {
  if (/\.AppImage$/i.test(name)) return 'appimage'
  if (/\.tar\.gz$/i.test(name)) return 'tarball'
  return 'other'
}

export function assetLabel(asset: Pick<ReleaseAsset, 'kind'>): string {
  if (asset.kind === 'appimage') return 'AppImage'
  if (asset.kind === 'tarball') return 'Tarball of the unpacked app'
  return 'File'
}

function parseAsset(input: unknown, tag: string): ReleaseAsset | null {
  if (!isRecord(input)) return null
  const { name, size, browser_download_url: url } = input
  if (typeof name !== 'string' || !/^[A-Za-z0-9._+-]{1,120}$/.test(name)) return null
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) return null
  if (url !== `${RELEASE_PREFIX}download/${tag}/${name}`) return null
  return { name, size, url, kind: assetKind(name) }
}

export function parseRelease(input: unknown): Release | null {
  if (!isRecord(input)) return null
  if (input.draft === true || input.prerelease === true) return null
  const { tag_name: tag, html_url: url, published_at: publishedAt } = input
  if (typeof tag !== 'string' || !TAG.test(tag)) return null
  if (url !== `${RELEASE_PREFIX}tag/${tag}`) return null
  if (typeof publishedAt !== 'string' || Number.isNaN(Date.parse(publishedAt))) return null
  const order = { appimage: 0, tarball: 1, other: 2 }
  const assets = (Array.isArray(input.assets) ? input.assets : [])
    .map((asset) => parseAsset(asset, tag))
    .filter((asset): asset is ReleaseAsset => asset !== null)
    .sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name))
  return { tag, version: tag.slice(1), publishedAt, url, assets }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  const units = ['B', 'kB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit += 1
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1
  return `${value.toFixed(digits)} ${units[unit]}`
}

export function formatDate(iso: string): string {
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return ''
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(time))
}

export function isNewer(candidate: string, current: string): boolean {
  const a = candidate.split('.').map(Number)
  const b = current.split('.').map(Number)
  for (let index = 0; index < 3; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0)
    if (diff !== 0) return diff > 0
  }
  return false
}
