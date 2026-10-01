import releaseSnapshot from '../data/release.snapshot.json'
import { type Release, parseRelease } from './release'

export const snapshotRelease: Release | null = parseRelease(releaseSnapshot.release)
