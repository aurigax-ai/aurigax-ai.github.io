import { describe, expect, it } from 'vitest'
import { escapeHtml, html, safeHttpUrl } from '../../src/lib/html'
import { parseManifest } from '../../src/lib/marketplace'
import { parseRelease } from '../../src/lib/release'
import { extensionCard, extensionList, releasePanel } from '../../src/lib/views'

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

describe('safeHttpUrl', () => {
  it('accepts only http and https', () => {
    expect(safeHttpUrl('https://example.com/x')).toBe('https://example.com/x')
    expect(safeHttpUrl('http://example.com')).toBe('http://example.com/')
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'not a url', 5, null]) {
      expect(safeHttpUrl(bad)).toBeNull()
    }
  })
})

describe('extensionCard', () => {
  it('shows name, version, category, capabilities and contributions', () => {
    const card = extensionCard(
      parseManifest(
        {
          id: 'keeper',
          name: 'Keeper',
          version: '1.1.0',
          category: 'tools',
          description: 'Dashboard',
          capabilities: ['notify'],
          main: 'main.js',
          contributes: { commands: [{ id: 'open', title: 'Keeper: Open Dashboard' }], sidebarItems: true },
        },
        'extensions/keeper',
        'https://github.com/o/r',
        'main',
      ),
    ).value
    for (const text of ['Keeper', '1.1.0', 'Tools', 'Dashboard', 'notify', 'Commands', 'Keeper: Open Dashboard', 'Sidebar items', 'Runs a program on this computer']) {
      expect(card).toContain(text)
    }
    expect(card).toContain('href="https://github.com/o/r/tree/main/extensions/keeper"')
  })

  it('renders hostile manifest text as text', () => {
    const card = extensionCard(
      parseManifest(
        {
          id: 'evil',
          name: HOSTILE,
          version: HOSTILE,
          description: HOSTILE,
          contributes: { commands: [{ title: HOSTILE }], panel: { title: HOSTILE } },
        },
        'extensions/evil',
      ),
    ).value
    expect(card).not.toContain('<img')
    expect(card).not.toContain('</script>')
    expect(card).not.toContain('onerror="')
    expect(card).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
  })

  it('summarises long contribution lists', () => {
    const commands = Array.from({ length: 9 }, (_, index) => ({ title: `Command ${index + 1}` }))
    const card = extensionCard(parseManifest({ id: 'many', name: 'Many', version: '1', contributes: { commands } }, 'p')).value
    expect(card).toContain('Command 6, and 3 more')
    expect(card).not.toContain('Command 7')
  })

  it('shows an unavailable entry without breaking, escaping its path', () => {
    const card = extensionCard({ status: 'unavailable', path: '<b>x</b>', reason: 'Its pine.json could not be read.' }).value
    expect(card).toContain('data-unavailable')
    expect(card).toContain('&lt;b&gt;x&lt;/b&gt;')
    expect(card).toContain('This entry is unavailable.')
  })

  it('says so when the list is empty', () => {
    expect(extensionList([]).value).toContain('No extension matches')
  })
})

describe('releasePanel', () => {
  it('lists the version, date and each file with size and link', () => {
    const release = parseRelease({
      tag_name: 'v0.3.0',
      html_url: 'https://github.com/aurigax-ai/pine/releases/tag/v0.3.0',
      published_at: '2026-10-01T16:30:19Z',
      assets: [
        {
          name: 'pine-0.3.0.AppImage',
          size: 167484018,
          browser_download_url: 'https://github.com/aurigax-ai/pine/releases/download/v0.3.0/pine-0.3.0.AppImage',
        },
      ],
    })
    if (!release) throw new Error('release did not parse')
    const panel = releasePanel(release).value
    expect(panel).toContain('data-release="0.3.0"')
    expect(panel).toContain('October 1, 2026')
    expect(panel).toContain('pine-0.3.0.AppImage, 167 MB')
    expect(panel).toContain('href="https://github.com/aurigax-ai/pine/releases/download/v0.3.0/pine-0.3.0.AppImage"')
  })
})
