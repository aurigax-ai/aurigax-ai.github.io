import { type MarketplaceView, categoriesOf, loadMarketplace, matches } from '../lib/marketplace'
import { MARKETPLACE_REPO } from '../lib/site'
import { extensionList } from '../lib/views'

const list = document.getElementById('extensions')
const form = document.getElementById('filters') as HTMLFormElement | null
const search = document.getElementById('search') as HTMLInputElement | null
const category = document.getElementById('category') as HTMLSelectElement | null
const statusNode = document.getElementById('extensions-status')

function snapshot(): MarketplaceView | null {
  try {
    return JSON.parse(document.getElementById('marketplace-snapshot')?.textContent ?? 'null')
  } catch {
    return null
  }
}

let view = snapshot()

function fillCategories(): void {
  if (!category || !view) return
  const chosen = category.value
  category.replaceChildren(new Option('All categories', ''))
  for (const item of categoriesOf(view.entries)) category.add(new Option(item.label, item.id))
  category.value = [...category.options].some((option) => option.value === chosen) ? chosen : ''
}

function draw(): void {
  if (!list || !view) return
  const shown = view.entries.filter((entry) => matches(entry, search?.value ?? '', category?.value ?? ''))
  list.innerHTML = extensionList(shown).value
}

function setStatus(text: string): void {
  if (statusNode) statusNode.textContent = text
}

if (form && view) {
  form.hidden = false
  form.addEventListener('submit', (event) => event.preventDefault())
  search?.addEventListener('input', draw)
  category?.addEventListener('change', draw)
  fillCategories()
}

loadMarketplace((url) => fetch(url), MARKETPLACE_REPO)
  .then((live) => {
    view = live
    if (form) form.hidden = false
    fillCategories()
    draw()
    const count = live.entries.filter((entry) => entry.status === 'ok').length
    setStatus(`${count} ${count === 1 ? 'extension' : 'extensions'}, read from ${MARKETPLACE_REPO} just now.`)
  })
  .catch(() => {
    setStatus(
      view
        ? 'GitHub could not be reached, so this is the list saved when this page was built.'
        : 'GitHub could not be reached. The list is in the marketplace repository.',
    )
  })
