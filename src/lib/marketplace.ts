import { safeHttpUrl } from './html'
import { PRODUCT } from './site'

export const MARKETPLACE_FILE = 'pine-marketplace.json'
export const MANIFEST_FILE = 'pine.json'
const MAX_EXTENSIONS = 200
const MAX_TEXT = 2000
const MAX_ITEMS = 64

export interface Marketplace {
  name: string
  description: string
  extensions: string[]
}

export interface Contribution {
  key: string
  label: string
  items: string[]
}

export interface ExtensionOk {
  status: 'ok'
  path: string
  id: string
  name: string
  version: string
  api: string
  description: string
  category: string
  categoryLabel: string
  capabilities: string[]
  contributions: Contribution[]
  runsProgram: boolean
  homepage: string | null
  sourceUrl: string | null
}

export interface ExtensionUnavailable {
  status: 'unavailable'
  path: string
  reason: string
}

export type ExtensionEntry = ExtensionOk | ExtensionUnavailable

export interface MarketplaceView {
  marketplace: Marketplace
  entries: ExtensionEntry[]
  branch: string
}

const CATEGORY_LABELS: Record<string, string> = {
  ai: 'AI',
  scm: 'Source control',
  tools: 'Tools',
  themes: 'Themes',
  langpack: 'Language pack',
  completions: 'Completions',
  other: 'Other',
}

const ACRONYMS = new Set(['ai', 'api', 'cli', 'id', 'lsp', 'mcp', 'scm', 'ssh', 'ui', 'url'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string {
  if (typeof value !== 'string') return ''
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replaceAll('{product}', PRODUCT)
    .trim()
  return cleaned.length > MAX_TEXT ? `${cleaned.slice(0, MAX_TEXT - 1)}…` : cleaned
}

export function humanize(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase())
  if (words.length === 0) return ''
  return words
    .map((word, index) => {
      if (ACRONYMS.has(word)) return word.toUpperCase()
      return index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word
    })
    .join(' ')
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? humanize(category)
}

export function isSafeExtensionPath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 200) return false
  if (value.startsWith('/') || value.includes('\\')) return false
  return value.split('/').every((part) => /^[A-Za-z0-9._-]+$/.test(part) && part !== '..' && part !== '.')
}

export function parseMarketplace(input: unknown): Marketplace | null {
  if (!isRecord(input)) return null
  const name = text(input.name)
  if (!name || !Array.isArray(input.extensions)) return null
  const seen = new Set<string>()
  const extensions: string[] = []
  for (const entry of input.extensions.slice(0, MAX_EXTENSIONS)) {
    const path = typeof entry === 'string' ? entry.replace(/\/+$/, '') : entry
    if (!isSafeExtensionPath(path) || seen.has(path)) continue
    seen.add(path)
    extensions.push(path)
  }
  return { name, description: text(input.description), extensions }
}

function itemName(item: unknown): string {
  if (typeof item === 'string') return text(item)
  if (isRecord(item)) {
    for (const field of ['title', 'label', 'name', 'id']) {
      const value = text(item[field])
      if (value) return value
    }
  }
  return ''
}

export function describeContributions(contributes: unknown): Contribution[] {
  if (!isRecord(contributes)) return []
  const result: Contribution[] = []
  for (const [key, value] of Object.entries(contributes)) {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(key)) continue
    const label = humanize(key)
    if (value === true) {
      result.push({ key, label, items: [] })
    } else if (typeof value === 'string') {
      const single = text(value)
      if (single) result.push({ key, label, items: [single] })
    } else if (Array.isArray(value)) {
      if (value.length === 0) continue
      result.push({ key, label, items: value.slice(0, MAX_ITEMS).map(itemName).filter(Boolean) })
    } else if (isRecord(value)) {
      const own = itemName(value)
      if (own) {
        result.push({ key, label, items: [own] })
        continue
      }
      const entries = Object.entries(value).slice(0, MAX_ITEMS)
      if (entries.length === 0) continue
      result.push({
        key,
        label,
        items: entries.map(([name, entry]) => itemName(entry) || humanize(name)).filter(Boolean),
      })
    }
  }
  return result
}

function unavailable(path: string, reason: string): ExtensionUnavailable {
  return { status: 'unavailable', path, reason }
}

export function parseManifest(input: unknown, path: string, repoUrl?: string, branch?: string): ExtensionEntry {
  if (!isRecord(input)) return unavailable(path, 'Its pine.json is not a JSON object.')
  const id = typeof input.id === 'string' ? input.id : ''
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(id)) return unavailable(path, 'Its pine.json has no valid id.')
  const name = text(input.name)
  const version = text(input.version)
  if (!name) return unavailable(path, 'Its pine.json has no name.')
  if (!version) return unavailable(path, 'Its pine.json has no version.')
  const rawCategory = typeof input.category === 'string' ? input.category : ''
  const category = /^[a-z][a-z0-9-]{0,31}$/.test(rawCategory) ? rawCategory : 'other'
  const capabilities = Array.isArray(input.capabilities)
    ? input.capabilities
        .filter((cap): cap is string => typeof cap === 'string' && /^[a-z][a-z0-9-]{0,47}$/.test(cap))
        .slice(0, MAX_ITEMS)
    : []
  return {
    status: 'ok',
    path,
    id,
    name,
    version,
    api: text(input.api),
    description: text(input.description),
    category,
    categoryLabel: categoryLabel(category),
    capabilities,
    contributions: describeContributions(input.contributes),
    runsProgram: typeof input.main === 'string' && input.main.length > 0,
    homepage: safeHttpUrl(input.homepage),
    sourceUrl: repoUrl && branch ? safeHttpUrl(`${repoUrl}/tree/${branch}/${path}`) : null,
  }
}

export function markDuplicates(entries: ExtensionEntry[]): ExtensionEntry[] {
  const seen = new Set<string>()
  return entries.map((entry) => {
    if (entry.status !== 'ok') return entry
    if (seen.has(entry.id)) {
      return unavailable(entry.path, `Another entry already uses the id ${entry.id}.`)
    }
    seen.add(entry.id)
    return entry
  })
}

export function categoriesOf(entries: ExtensionEntry[]): { id: string; label: string }[] {
  const map = new Map<string, string>()
  for (const entry of entries) {
    if (entry.status === 'ok') map.set(entry.category, entry.categoryLabel)
  }
  return [...map].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label))
}

export function matches(entry: ExtensionEntry, query: string, category: string): boolean {
  if (entry.status !== 'ok') return category === '' && query.trim() === ''
  if (category && entry.category !== category) return false
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const haystack = [
    entry.name,
    entry.id,
    entry.description,
    entry.categoryLabel,
    ...entry.capabilities,
    ...entry.contributions.flatMap((item) => [item.label, ...item.items]),
  ]
    .join('\n')
    .toLowerCase()
  return needle.split(/\s+/).every((word) => haystack.includes(word))
}

type Fetcher = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>

export function rawUrl(repo: string, branch: string, path: string): string {
  return `https://raw.githubusercontent.com/${repo}/${branch}/${path}`
}

async function readJson(fetcher: Fetcher, url: string): Promise<unknown> {
  const response = await fetcher(url)
  if (!response.ok) throw new Error(`${response.status} for ${url}`)
  return response.json()
}

async function defaultBranch(fetcher: Fetcher, repo: string): Promise<string> {
  const info = await readJson(fetcher, `https://api.github.com/repos/${repo}`)
  const branch = isRecord(info) ? info.default_branch : null
  if (typeof branch !== 'string' || !/^[A-Za-z0-9._/-]{1,100}$/.test(branch) || branch.includes('..')) {
    throw new Error('no default branch')
  }
  return branch
}

async function readMarketplace(fetcher: Fetcher, repo: string): Promise<{ branch: string; marketplace: Marketplace }> {
  let branch = 'main'
  let raw: unknown
  try {
    raw = await readJson(fetcher, rawUrl(repo, branch, MARKETPLACE_FILE))
  } catch {
    branch = await defaultBranch(fetcher, repo)
    if (branch === 'main') throw new Error('marketplace file missing')
    raw = await readJson(fetcher, rawUrl(repo, branch, MARKETPLACE_FILE))
  }
  const marketplace = parseMarketplace(raw)
  if (!marketplace) throw new Error('marketplace file is malformed')
  return { branch, marketplace }
}

export async function loadMarketplace(fetcher: Fetcher, repo: string): Promise<MarketplaceView> {
  const { branch, marketplace } = await readMarketplace(fetcher, repo)
  const repoUrl = `https://github.com/${repo}`
  const entries = await Promise.all(
    marketplace.extensions.map(async (path): Promise<ExtensionEntry> => {
      try {
        const manifest = await readJson(fetcher, rawUrl(repo, branch, `${path}/${MANIFEST_FILE}`))
        return parseManifest(manifest, path, repoUrl, branch)
      } catch {
        return unavailable(path, 'Its pine.json could not be read.')
      }
    }),
  )
  return { marketplace, entries: markDuplicates(entries), branch }
}
