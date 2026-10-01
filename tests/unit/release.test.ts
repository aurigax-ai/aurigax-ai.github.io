import { describe, expect, it } from 'vitest'
import { assetKind, assetLabel, formatBytes, formatDate, isNewer, parseRelease } from '../../src/lib/release'

const base = 'https://github.com/aurigax-ai/pine/releases'
const valid = {
  tag_name: 'v0.3.0',
  html_url: `${base}/tag/v0.3.0`,
  published_at: '2026-10-01T16:30:19Z',
  draft: false,
  prerelease: false,
  assets: [
    { name: 'pine-0.3.0-linux-x64.tar.gz', size: 164595340, browser_download_url: `${base}/download/v0.3.0/pine-0.3.0-linux-x64.tar.gz` },
    { name: 'pine-0.3.0.AppImage', size: 167484018, browser_download_url: `${base}/download/v0.3.0/pine-0.3.0.AppImage` },
  ],
}

describe('parseRelease', () => {
  it('reads the version, date and files, AppImage first', () => {
    const release = parseRelease(valid)
    expect(release).toMatchObject({ tag: 'v0.3.0', version: '0.3.0', url: `${base}/tag/v0.3.0` })
    expect(release?.assets.map((asset) => asset.kind)).toEqual(['appimage', 'tarball'])
  })

  it('refuses drafts, prereleases and odd tags', () => {
    expect(parseRelease({ ...valid, draft: true })).toBeNull()
    expect(parseRelease({ ...valid, prerelease: true })).toBeNull()
    expect(parseRelease({ ...valid, tag_name: 'nightly' })).toBeNull()
    expect(parseRelease({ ...valid, published_at: 'soon' })).toBeNull()
  })

  it('refuses a release page that is not the repository tag page', () => {
    expect(parseRelease({ ...valid, html_url: 'https://evil.example/releases/tag/v0.3.0' })).toBeNull()
    expect(parseRelease({ ...valid, html_url: 'javascript:alert(1)' })).toBeNull()
  })

  it('drops files whose link is not a download of that release', () => {
    const release = parseRelease({
      ...valid,
      assets: [
        { name: 'pine-0.3.0.AppImage', size: 1, browser_download_url: 'https://evil.example/pine-0.3.0.AppImage' },
        { name: '<b>.AppImage', size: 1, browser_download_url: `${base}/download/v0.3.0/<b>.AppImage` },
        { name: 'ok.AppImage', size: -5, browser_download_url: `${base}/download/v0.3.0/ok.AppImage` },
        'nonsense',
        valid.assets[1],
      ],
    })
    expect(release?.assets.map((asset) => asset.name)).toEqual(['pine-0.3.0.AppImage'])
  })

  it('accepts a release without files and rejects non-objects', () => {
    expect(parseRelease({ ...valid, assets: undefined })?.assets).toEqual([])
    for (const input of [null, 'x', [], { message: 'API rate limit exceeded' }]) {
      expect(parseRelease(input)).toBeNull()
    }
  })
})

describe('formatting', () => {
  it('formats sizes in decimal units', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(999)).toBe('999 B')
    expect(formatBytes(1500)).toBe('1.5 kB')
    expect(formatBytes(167484018)).toBe('167 MB')
    expect(formatBytes(64595340)).toBe('64.6 MB')
    expect(formatBytes(2_500_000_000)).toBe('2.5 GB')
    expect(formatBytes(Number.NaN)).toBe('')
    expect(formatBytes(-1)).toBe('')
  })

  it('formats dates in UTC', () => {
    expect(formatDate('2026-10-01T23:59:59Z')).toBe('October 1, 2026')
    expect(formatDate('nope')).toBe('')
  })

  it('names file kinds', () => {
    expect(assetKind('pine-0.3.0.AppImage')).toBe('appimage')
    expect(assetKind('pine-0.3.0-linux-x64.tar.gz')).toBe('tarball')
    expect(assetKind('checksums.txt')).toBe('other')
    expect(assetLabel({ kind: 'appimage' })).toBe('AppImage')
    expect(assetLabel({ kind: 'tarball' })).toBe('Tarball of the unpacked app')
  })

  it('compares versions numerically', () => {
    expect(isNewer('0.10.0', '0.9.0')).toBe(true)
    expect(isNewer('0.3.0', '0.3.0')).toBe(false)
    expect(isNewer('0.2.9', '0.3.0')).toBe(false)
  })
})
