import marketplaceSnapshot from '../data/marketplace.snapshot.json'
import releaseSnapshot from '../data/release.snapshot.json'
import { type MarketplaceView, markDuplicates, parseManifest, parseMarketplace } from './marketplace'
import { type Release, parseRelease } from './release'

interface MarketplaceSnapshot {
  repo: string
  branch: string
  fetchedAt: string
  marketplace: unknown
  manifests: Record<string, unknown>
}

export function viewFromSnapshot(snapshot: MarketplaceSnapshot): MarketplaceView | null {
  const marketplace = parseMarketplace(snapshot.marketplace)
  if (!marketplace) return null
  const repoUrl = `https://github.com/${snapshot.repo}`
  const entries = marketplace.extensions.map((path) =>
    parseManifest(snapshot.manifests[path] ?? null, path, repoUrl, snapshot.branch),
  )
  return { marketplace, entries: markDuplicates(entries), branch: snapshot.branch }
}

export const snapshotView: MarketplaceView | null = viewFromSnapshot(marketplaceSnapshot)
export const snapshotViewDate: string = marketplaceSnapshot.fetchedAt
export const snapshotRelease: Release | null = parseRelease(releaseSnapshot.release)
