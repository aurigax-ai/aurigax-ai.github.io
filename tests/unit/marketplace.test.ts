import { describe, expect, it } from 'vitest'
import {
  categoriesOf,
  describeContributions,
  humanize,
  isSafeExtensionPath,
  loadMarketplace,
  markDuplicates,
  matches,
  parseManifest,
  parseMarketplace,
} from '../../src/lib/marketplace'
import { viewFromSnapshot } from '../../src/lib/snapshot'

const keeper = {
  id: 'keeper',
  name: 'Keeper',
  version: '1.1.0',
  api: '1.1',
  description: 'Counts queries while {product} is focused',
  category: 'tools',
  capabilities: ['read-board', 'notify'],
  main: 'main.js',
  contributes: {
    commands: [
      { id: 'open', title: 'Keeper: Open Dashboard' },
      { id: 'approvals', title: 'Keeper: Show Pending Approvals' },
    ],
    sidebarItems: true,
    panel: { title: 'Keeper', icon: 'shield', entry: 'url' },
    settings: { notify: { type: 'boolean', title: 'Approval notifications' }, pollSeconds: { type: 'number' } },
  },
}

function fetcher(files: Record<string, unknown>) {
  return async (url: string) => {
    const found = url in files
    return { ok: found, status: found ? 200 : 404, json: async () => files[url] }
  }
}

describe('parseMarketplace', () => {
  it('keeps the name, description and safe extension paths', () => {
    expect(
      parseMarketplace({ name: 'Pine extensions', description: 'More', extensions: ['extensions/keeper/'] }),
    ).toEqual({ name: 'Pine extensions', description: 'More', extensions: ['extensions/keeper'] })
  })

  it('returns null for anything that is not a marketplace', () => {
    for (const input of [null, 'text', [], {}, { name: 'x' }, { name: '', extensions: [] }, { extensions: [] }]) {
      expect(parseMarketplace(input)).toBeNull()
    }
  })

  it('drops unsafe, duplicate and non-string paths', () => {
    const result = parseMarketplace({
      name: 'x',
      extensions: ['a/b', 'a/b', '../secret', '/etc', 'a\\b', 'has space', 7, null, 'https://evil.example/x', 'ok'],
    })
    expect(result?.extensions).toEqual(['a/b', 'ok'])
  })

  it('caps the list at 200 entries', () => {
    const extensions = Array.from({ length: 300 }, (_, index) => `e/${index}`)
    expect(parseMarketplace({ name: 'x', extensions })?.extensions).toHaveLength(200)
  })
})

describe('isSafeExtensionPath', () => {
  it('accepts nested folders and refuses traversal', () => {
    expect(isSafeExtensionPath('extensions/model-runtime')).toBe(true)
    expect(isSafeExtensionPath('extensions/../x')).toBe(false)
    expect(isSafeExtensionPath('./x')).toBe(false)
    expect(isSafeExtensionPath('')).toBe(false)
  })
})

describe('parseManifest', () => {
  it('builds a view of a full manifest', () => {
    const entry = parseManifest(keeper, 'extensions/keeper', 'https://github.com/o/r', 'main')
    expect(entry).toMatchObject({
      status: 'ok',
      id: 'keeper',
      name: 'Keeper',
      version: '1.1.0',
      category: 'tools',
      categoryLabel: 'Tools',
      capabilities: ['read-board', 'notify'],
      runsProgram: true,
      sourceUrl: 'https://github.com/o/r/tree/main/extensions/keeper',
    })
  })

  it('replaces the product placeholder', () => {
    const entry = parseManifest(keeper, 'p')
    expect(entry.status === 'ok' && entry.description).toBe('Counts queries while Pine is focused')
  })

  it('marks a malformed manifest unavailable with a reason', () => {
    for (const input of [null, 'x', [], {}, { id: 'UPPER', name: 'x', version: '1' }, { id: 'ok-id', version: '1' }, { id: 'ok-id', name: 'x' }]) {
      const entry = parseManifest(input, 'extensions/broken')
      expect(entry.status).toBe('unavailable')
      expect(entry.path).toBe('extensions/broken')
    }
  })

  it('fills defaults when optional fields are missing or wrong', () => {
    const entry = parseManifest({ id: 'tiny', name: 'Tiny', version: '0.1.0', capabilities: 'all', category: 7 }, 'p')
    expect(entry).toMatchObject({
      status: 'ok',
      category: 'other',
      categoryLabel: 'Other',
      capabilities: [],
      contributions: [],
      runsProgram: false,
      description: '',
      homepage: null,
      sourceUrl: null,
    })
  })

  it('labels a category it has never seen', () => {
    const entry = parseManifest({ id: 'tiny', name: 'Tiny', version: '1', category: 'data-viz' }, 'p')
    expect(entry.status === 'ok' && entry.categoryLabel).toBe('Data viz')
  })

  it('keeps only http and https links', () => {
    const bad = parseManifest({ id: 'tiny', name: 'T', version: '1', homepage: 'javascript:alert(1)' }, 'p')
    const good = parseManifest({ id: 'tiny', name: 'T', version: '1', homepage: 'https://example.com/a' }, 'p')
    expect(bad.status === 'ok' && bad.homepage).toBeNull()
    expect(good.status === 'ok' && good.homepage).toBe('https://example.com/a')
  })

  it('drops capability names that are not plain identifiers', () => {
    const entry = parseManifest({ id: 'tiny', name: 'T', version: '1', capabilities: ['notify', '<b>x</b>', 3] }, 'p')
    expect(entry.status === 'ok' && entry.capabilities).toEqual(['notify'])
  })

  it('strips control characters and clips very long text', () => {
    const entry = parseManifest({ id: 'tiny', name: 'A\u0000B\nC', version: '1', description: 'x'.repeat(5000) }, 'p')
    expect(entry.status === 'ok' && entry.name).toBe('A B C')
    expect(entry.status === 'ok' && entry.description.length).toBe(2000)
  })
})

describe('describeContributions', () => {
  it('derives labels and items from known shapes', () => {
    expect(describeContributions(keeper.contributes)).toEqual([
      { key: 'commands', label: 'Commands', items: ['Keeper: Open Dashboard', 'Keeper: Show Pending Approvals'] },
      { key: 'sidebarItems', label: 'Sidebar items', items: [] },
      { key: 'panel', label: 'Panel', items: ['Keeper'] },
      { key: 'settings', label: 'Settings', items: ['Approval notifications', 'Poll seconds'] },
    ])
  })

  it('shows a contribution kind it has never seen', () => {
    expect(
      describeContributions({
        holoDecks: [{ label: 'Bridge' }, { id: 'ten-forward' }, 'Cargo bay'],
        assist: ['input', 'chat'],
        iconThemes: [{ id: 'material', label: 'Material', path: 'x.json' }],
        languageServers: { rust: { name: 'rust-analyzer' } },
      }),
    ).toEqual([
      { key: 'holoDecks', label: 'Holo decks', items: ['Bridge', 'ten-forward', 'Cargo bay'] },
      { key: 'assist', label: 'Assist', items: ['input', 'chat'] },
      { key: 'iconThemes', label: 'Icon themes', items: ['Material'] },
      { key: 'languageServers', label: 'Language servers', items: ['rust-analyzer'] },
    ])
  })

  it('ignores switched off, empty and malformed contributions', () => {
    expect(describeContributions({ sidebarItems: false, commands: [], settings: {}, count: 3, '<img>': true })).toEqual([])
    expect(describeContributions(null)).toEqual([])
    expect(describeContributions(['x'])).toEqual([])
  })
})

describe('humanize', () => {
  it('splits camel case and keeps acronyms upper case', () => {
    expect(humanize('paneChips')).toBe('Pane chips')
    expect(humanize('mcpServers')).toBe('MCP servers')
    expect(humanize('ai')).toBe('AI')
  })
})

describe('markDuplicates', () => {
  it('keeps the first entry with an id and marks later ones unavailable', () => {
    const first = parseManifest(keeper, 'a')
    const second = parseManifest(keeper, 'b')
    const [kept, dropped] = markDuplicates([first, second])
    expect(kept?.status).toBe('ok')
    expect(dropped).toMatchObject({ status: 'unavailable', path: 'b' })
  })
})

describe('matches and categoriesOf', () => {
  const entries = [
    parseManifest(keeper, 'a'),
    parseManifest({ id: 'model-runtime', name: 'Model runtime', version: '1', category: 'ai' }, 'b'),
    parseManifest(null, 'c'),
  ]

  it('lists each category once, sorted by label', () => {
    expect(categoriesOf(entries)).toEqual([
      { id: 'ai', label: 'AI' },
      { id: 'tools', label: 'Tools' },
    ])
  })

  it('searches names, descriptions, capabilities and contributions', () => {
    const found = (query: string, category = '') => entries.filter((entry) => matches(entry, query, category)).length
    expect(found('')).toBe(3)
    expect(found('KEEPER')).toBe(1)
    expect(found('read-board')).toBe(1)
    expect(found('pending approvals')).toBe(1)
    expect(found('nothing-like-this')).toBe(0)
    expect(found('', 'ai')).toBe(1)
    expect(found('keeper', 'ai')).toBe(0)
  })
})

describe('loadMarketplace', () => {
  const raw = 'https://raw.githubusercontent.com/o/r'

  it('reads the marketplace and every manifest from main', async () => {
    const view = await loadMarketplace(
      fetcher({
        [`${raw}/main/pine-marketplace.json`]: { name: 'M', extensions: ['extensions/keeper', 'extensions/gone'] },
        [`${raw}/main/extensions/keeper/pine.json`]: keeper,
      }),
      'o/r',
    )
    expect(view.branch).toBe('main')
    expect(view.entries.map((entry) => entry.status)).toEqual(['ok', 'unavailable'])
  })

  it('asks for the default branch when main has no marketplace file', async () => {
    const view = await loadMarketplace(
      fetcher({
        'https://api.github.com/repos/o/r': { default_branch: 'trunk' },
        [`${raw}/trunk/pine-marketplace.json`]: { name: 'M', extensions: ['x'] },
        [`${raw}/trunk/x/pine.json`]: { ...keeper, id: 'x-ext' },
      }),
      'o/r',
    )
    expect(view.branch).toBe('trunk')
    expect(view.entries[0]).toMatchObject({ status: 'ok', sourceUrl: 'https://github.com/o/r/tree/trunk/x' })
  })

  it('rejects when nothing can be read or the file is malformed', async () => {
    await expect(loadMarketplace(fetcher({}), 'o/r')).rejects.toThrow()
    await expect(
      loadMarketplace(fetcher({ [`${raw}/main/pine-marketplace.json`]: { extensions: 'no' } }), 'o/r'),
    ).rejects.toThrow()
  })

  it('survives a manifest whose JSON cannot be parsed', async () => {
    const files = fetcher({ [`${raw}/main/pine-marketplace.json`]: { name: 'M', extensions: ['bad'] } })
    const view = await loadMarketplace(async (url) => {
      if (url.endsWith('bad/pine.json')) {
        return { ok: true, status: 200, json: async () => Promise.reject(new SyntaxError('bad json')) }
      }
      return files(url)
    }, 'o/r')
    expect(view.entries).toEqual([{ status: 'unavailable', path: 'bad', reason: 'Its pine.json could not be read.' }])
  })
})

describe('viewFromSnapshot', () => {
  it('turns a saved snapshot into the same view, with missing manifests unavailable', () => {
    const view = viewFromSnapshot({
      repo: 'o/r',
      branch: 'main',
      fetchedAt: '2026-10-01T00:00:00Z',
      marketplace: { name: 'M', extensions: ['a', 'b'] },
      manifests: { a: keeper, b: null },
    })
    expect(view?.entries.map((entry) => entry.status)).toEqual(['ok', 'unavailable'])
  })

  it('returns null for a broken snapshot', () => {
    expect(
      viewFromSnapshot({ repo: 'o/r', branch: 'main', fetchedAt: '', marketplace: null, manifests: {} }),
    ).toBeNull()
  })
})
