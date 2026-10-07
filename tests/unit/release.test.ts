import { describe, expect, it } from 'vitest'
import { assetAction, assetKind, assetLabel, formatBytes, formatDate, isNewer, parseRelease } from '../../src/lib/release'

const base = 'https://github.com/aurigax-ai/ostia/releases'
const valid = {
  tag_name: 'v0.3.0',
  html_url: `${base}/tag/v0.3.0`,
  published_at: '2026-10-01T16:30:19Z',
  draft: false,
  prerelease: false,
  assets: [
    { name: 'pine-0.3.0-linux-x64.tar.gz', size: 164595340, browser_download_url: `${base}/download/v0.3.0/pine-0.3.0-linux-x64.tar.gz` },
    { name: 'pine-0.3.0.deb', size: 167484018, browser_download_url: `${base}/download/v0.3.0/pine-0.3.0.deb` },
  ],
}

describe('parseRelease', () => {
  it('reads the version, date and files', () => {
    const release = parseRelease(valid)
    expect(release).toMatchObject({ tag: 'v0.3.0', version: '0.3.0', url: `${base}/tag/v0.3.0` })
    expect(release?.assets.map((asset) => asset.kind)).toEqual(['tarball', 'deb'])
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
        { name: 'pine-0.3.0.deb', size: 1, browser_download_url: 'https://evil.example/pine-0.3.0.deb' },
        { name: '<b>.deb', size: 1, browser_download_url: `${base}/download/v0.3.0/<b>.deb` },
        { name: 'ok.deb', size: -5, browser_download_url: `${base}/download/v0.3.0/ok.deb` },
        'nonsense',
        valid.assets[0],
      ],
    })
    expect(release?.assets.map((asset) => asset.name)).toEqual(['pine-0.3.0-linux-x64.tar.gz'])
  })

  it('reads files named after either product: ostia-* from 0.5.6 on, pine-* before', () => {
    const release = parseRelease({
      ...valid,
      tag_name: 'v0.5.6',
      html_url: `${base}/tag/v0.5.6`,
      assets: [
        { name: 'ostia-0.5.6-linux-x64.tar.gz', size: 1, browser_download_url: `${base}/download/v0.5.6/ostia-0.5.6-linux-x64.tar.gz` },
        { name: 'ostia_0.5.6_amd64.deb', size: 1, browser_download_url: `${base}/download/v0.5.6/ostia_0.5.6_amd64.deb` },
      ],
    })
    expect(release?.assets.map((asset) => [asset.name, asset.kind])).toEqual([
      ['ostia-0.5.6-linux-x64.tar.gz', 'tarball'],
      ['ostia_0.5.6_amd64.deb', 'deb'],
    ])
    expect(parseRelease(valid)?.assets.map((asset) => asset.name)).toEqual([
      'pine-0.3.0-linux-x64.tar.gz',
      'pine-0.3.0.deb',
    ])
  })

  it('no longer offers an AppImage, even on releases that still carry one', () => {
    const release = parseRelease({
      ...valid,
      assets: [...valid.assets, { name: 'pine-0.3.0.AppImage', size: 1, browser_download_url: `${base}/download/v0.3.0/pine-0.3.0.AppImage` }],
    })
    expect(release?.assets.map((asset) => asset.kind)).toEqual(['tarball', 'deb'])
  })

  it('refuses links under the repository name it had before the rename', () => {
    const old = 'https://github.com/aurigax-ai/pine/releases'
    expect(parseRelease({ ...valid, html_url: `${old}/tag/v0.3.0` })).toBeNull()
    const release = parseRelease({
      ...valid,
      assets: [{ ...valid.assets[0], browser_download_url: `${old}/download/v0.3.0/pine-0.3.0-linux-x64.tar.gz` }],
    })
    expect(release?.assets).toEqual([])
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
    expect(assetKind('pine-0.3.0.AppImage')).toBe('other')
    expect(assetKind('pine-0.3.0-linux-x64.tar.gz')).toBe('tarball')
    expect(assetKind('ostia-0.5.6-linux-x64.tar.gz')).toBe('tarball')
    expect(assetKind('ostia-0.5.6-arm64.dmg')).toBe('dmg')
    expect(assetKind('ostia_0.5.7_amd64.deb')).toBe('deb')
    expect(assetKind('checksums.txt')).toBe('other')
    expect(assetLabel({ kind: 'dmg' })).toBe('macOS 13 or later disk image, Apple silicon')
    expect(assetLabel({ kind: 'tarball' })).toBe('Linux tarball of the unpacked app, x64')
    expect(assetLabel({ kind: 'deb' })).toBe('Debian and Ubuntu package, x64')
    expect(assetAction({ kind: 'dmg' })).toBe('Get the disk image')
    expect(assetAction({ kind: 'deb' })).toBe('Get the .deb')
    expect(assetAction({ kind: 'other' })).toBe('Get the file')
  })

  it('lists the macOS disk image first, then the Linux files', () => {
    const release = parseRelease({
      ...valid,
      tag_name: 'v0.5.7',
      html_url: `${base}/tag/v0.5.7`,
      assets: ['ostia_0.5.7_amd64.deb', 'ostia-0.5.7-linux-x64.tar.gz', 'ostia-0.5.7-arm64.dmg'].map(
        (name) => ({ name, size: 1, browser_download_url: `${base}/download/v0.5.7/${name}` }),
      ),
    })
    expect(release?.assets.map((asset) => asset.kind)).toEqual(['dmg', 'tarball', 'deb'])
  })

  it('compares versions numerically', () => {
    expect(isNewer('0.10.0', '0.9.0')).toBe(true)
    expect(isNewer('0.3.0', '0.3.0')).toBe(false)
    expect(isNewer('0.2.9', '0.3.0')).toBe(false)
  })
})
