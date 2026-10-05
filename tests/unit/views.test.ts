import { describe, expect, it } from 'vitest'
import { escapeHtml, html } from '../../src/lib/html'
import { parseRelease } from '../../src/lib/release'
import { releasePanel } from '../../src/lib/views'

const HOSTILE = '<img src=x onerror="alert(1)">&"\'</script>'

describe('html', () => {
  it('escapes every interpolated value', () => {
    expect(html`<p>${HOSTILE}</p>`.value).toBe(
      '<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&quot;&#39;&lt;/script&gt;</p>',
    )
  })

  it('keeps nested templates and skips empty values', () => {
    expect(html`<ul>${['a', '<b>'].map((item) => html`<li>${item}</li>`)}${null}${false}${undefined}</ul>`.value).toBe(
      '<ul><li>a</li><li>&lt;b&gt;</li></ul>',
    )
  })

  it('escapes numbers and plain strings alike', () => {
    expect(escapeHtml(5)).toBe('5')
    expect(escapeHtml(null)).toBe('')
  })
})

describe('releasePanel', () => {
  it('lists the version, date and each file with size and link', () => {
    const release = parseRelease({
      tag_name: 'v0.3.0',
      html_url: 'https://github.com/aurigax-ai/ostia/releases/tag/v0.3.0',
      published_at: '2026-10-01T16:30:19Z',
      assets: [
        {
          name: 'pine-0.3.0.AppImage',
          size: 167484018,
          browser_download_url: 'https://github.com/aurigax-ai/ostia/releases/download/v0.3.0/pine-0.3.0.AppImage',
        },
      ],
    })
    if (!release) throw new Error('release did not parse')
    const panel = releasePanel(release).value
    expect(panel).toContain('data-release="0.3.0"')
    expect(panel).toContain('October 1, 2026')
    expect(panel).toContain('pine-0.3.0.AppImage, 167 MB')
    expect(panel).toContain('href="https://github.com/aurigax-ai/ostia/releases/download/v0.3.0/pine-0.3.0.AppImage"')
  })
})
