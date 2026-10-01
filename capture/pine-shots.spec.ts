import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type ElectronApplication, type Page, _electron as electron, expect, test } from '@playwright/test'
import { DOM_RENDERER_SETTINGS, freshDataHome, isolatedLaunch, seedSettings } from './dataHome'
import { PROMPT, openWorkspace } from './helpers'

const OUT = '/tmp/pine-shots'
const THEME = process.env.SHOT_THEME ?? 'adeberry'

function seedProject(home: string): string {
  const project = join(home, 'demo-shop')
  mkdirSync(join(project, 'src'), { recursive: true })
  mkdirSync(join(project, 'public'), { recursive: true })
  writeFileSync(join(home, '.zshrc'), "PROMPT='%~ ❯ '\n")
  writeFileSync(join(home, '.bashrc'), "PS1='\\w ❯ '\n")
  writeFileSync(join(home, '.gitconfig'), '[user]\n\tname = Demo Dev\n\temail = dev@example.com\n[init]\n\tdefaultBranch = main\n[core]\n\tpager = cat\n')
  writeFileSync(
    join(project, 'package.json'),
    `${JSON.stringify({ name: 'demo-shop', version: '1.0.0', private: true, type: 'module', scripts: { start: 'node src/server.js', test: 'node --test' } }, null, 2)}\n`,
  )
  writeFileSync(join(project, 'README.md'), '# demo-shop\n\nA tiny shop used to show Pine.\n\n- `npm start` serves the storefront on port 4173\n- `npm test` runs the cart tests\n')
  writeFileSync(
    join(project, 'src', 'cart.js'),
    `export function addItem(cart, item) {
  const existing = cart.find((line) => line.sku === item.sku)
  if (existing) {
    return cart.map((line) =>
      line.sku === item.sku ? { ...line, quantity: line.quantity + 1 } : line,
    )
  }
  return [...cart, { ...item, quantity: 1 }]
}

export function total(cart) {
  return cart.reduce((sum, line) => sum + line.price * line.quantity, 0)
}
`,
  )
  writeFileSync(
    join(project, 'src', 'cart.test.js'),
    `import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addItem, total } from './cart.js'

const mug = { sku: 'mug', name: 'Mug', price: 12 }
const cap = { sku: 'cap', name: 'Cap', price: 18 }

test('adds a new item with quantity one', () => {
  assert.deepEqual(addItem([], mug), [{ ...mug, quantity: 1 }])
})

test('adding the same item raises its quantity', () => {
  assert.equal(addItem(addItem([], mug), mug)[0].quantity, 2)
})

test('totals price times quantity', () => {
  assert.equal(total(addItem(addItem(addItem([], mug), mug), cap)), 42)
})
`,
  )
  writeFileSync(
    join(project, 'src', 'server.js'),
    `import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'

const page = new URL('../public/index.html', import.meta.url)

createServer(async (_request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  response.end(await readFile(page))
}).listen(4173, '127.0.0.1', () => {
  console.log('demo-shop listening on http://127.0.0.1:4173')
})
`,
  )
  writeFileSync(
    join(project, 'public', 'index.html'),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Demo Shop</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; background: #f6f5f1; color: #20231f; }
      header, main { max-width: 520px; box-sizing: border-box; }
      header { padding: 20px 32px; border-bottom: 1px solid #dcdad2; display: flex; justify-content: space-between; }
      main { padding: 32px; display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 20px; }
      article { background: #fff; border: 1px solid #dcdad2; border-radius: 10px; padding: 20px; }
      h1 { font-size: 18px; margin: 0; }
      h2 { font-size: 16px; margin: 0 0 6px; }
      p { margin: 0 0 14px; color: #5c6058; }
      button { font: inherit; padding: 8px 14px; border-radius: 8px; border: 0; background: #2f5d46; color: #fff; }
    </style>
  </head>
  <body>
    <header><h1>Demo Shop</h1><span id="count">Cart: 0</span></header>
    <main>
      <article><h2>Mug</h2><p>$12</p><button>Add to cart</button></article>
      <article><h2>Cap</h2><p>$18</p><button>Add to cart</button></article>
      <article><h2>Notebook</h2><p>$9</p><button>Add to cart</button></article>
    </main>
    <script>
      let count = 0
      for (const button of document.querySelectorAll('button')) {
        button.addEventListener('click', () => {
          count += 1
          document.getElementById('count').textContent = 'Cart: ' + count
        })
      }
    </script>
  </body>
</html>
`,
  )
  const git = (...args: string[]) => execFileSync('git', args, { cwd: project, stdio: 'ignore', env: { ...process.env, HOME: home } })
  git('init', '-b', 'main')
  git('add', '-A')
  git('commit', '-m', 'feat: storefront and cart')
  writeFileSync(join(project, 'src', 'discount.js'), 'export function discount(amount, percent) {\n  return amount - (amount * percent) / 100\n}\n')
  writeFileSync(join(project, 'README.md'), '# demo-shop\n\nA tiny shop used to show Pine.\n\n- `npm start` serves the storefront on port 4173\n- `npm test` runs the cart tests\n- `src/discount.js` applies a percentage discount\n')
  return project
}

async function launch(extra: Record<string, unknown> = {}) {
  const dataHome = freshDataHome()
  rmSync('/tmp/home', { recursive: true, force: true })
  const home = '/tmp/home/dev'
  mkdirSync(home, { recursive: true })
  const project = seedProject(home)
  seedSettings(dataHome, {
    ...DOM_RENDERER_SETTINGS,
    appearance: { theme: THEME },
    panes: { dimInactive: false },
    workspaces: { ...DOM_RENDERER_SETTINGS.workspaces, defaultFolder: project },
    ...extra,
  })
  const options = isolatedLaunch(dataHome)
  const app = await electron.launch({
    ...options,
    args: ['--force-device-scale-factor=2', ...options.args],
    env: { ...options.env, HOME: home, SHELL: '/usr/bin/zsh' },
  })
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0]
    w.setPosition(0, 0)
    w.setContentSize(1440, 900)
  })
  await win.waitForTimeout(500)
  return { app, win, home, project, dataHome }
}

async function resize(app: ElectronApplication, win: Page, width: number, height: number) {
  await app.evaluate(({ BrowserWindow }, size) => {
    BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height)
  }, { width, height })
  await win.waitForTimeout(1200)
}

async function quit(app: ElectronApplication) {
  await app.evaluate(({ app: a }) => { setTimeout(() => a.exit(0), 0) }).catch(() => {})
  await app.close().catch(() => {})
}

async function run(win: Page, line: string, wait = 1200) {
  await win.keyboard.type(line, { delay: 8 })
  await win.keyboard.press('Enter')
  await win.waitForTimeout(wait)
}

async function shot(win: Page, name: string) {
  await win.waitForTimeout(600)
  await win.screenshot({ path: join(OUT, `${name}-${THEME}.png`) })
}

async function palette(win: Page, title: string) {
  await win.keyboard.press('Control+Shift+P')
  await win.keyboard.type(title, { delay: 10 })
  await win.waitForTimeout(500)
  await win.keyboard.press('Enter')
  await win.waitForTimeout(800)
}



async function park(win: Page) {
  await win.mouse.move(720, 700)
}

async function dragTabRight(win: Page, title: string) {
  const tab = win.locator('.pane-tab:visible').filter({ hasText: title }).first()
  const pane = win.locator('.pane:visible').filter({ has: tab }).first()
  const box = await pane.boundingBox()
  if (!box) throw new Error('no pane')
  await tab.dragTo(pane, { targetPosition: { x: box.width - 16, y: box.height / 2 } })
  await win.waitForTimeout(1200)
}

test('hero', async () => {
  test.setTimeout(180_000)
  const { app, win } = await launch()
  try {
    await openWorkspace(win)
    await win.locator('.xterm').first().click()
    await run(win, 'ls')
    await run(win, 'git status --short')
    await run(win, 'node --test --test-reporter=dot', 3000)
    await run(win, 'pine process run "node src/server.js" --name storefront', 3000)
    await win.locator('.topbar').getByRole('button', { name: 'Files', exact: true }).click()
    const tree = win.locator('.file-tree')
    await tree.getByRole('button', { name: 'src', exact: true }).click()
    await win.waitForTimeout(600)
    await tree.getByRole('button', { name: 'cart.js', exact: true }).click()
    await win.waitForTimeout(2000)
    await dragTabRight(win, 'cart.js')
    await win.locator('.pane-tab:visible').filter({ hasText: 'zsh' }).first().click()
    await win.waitForTimeout(1500)
    await park(win)
    await shot(win, 'hero')
  } finally {
    await quit(app)
  }
})

test('blocks', async () => {
  test.setTimeout(180_000)
  const { app, win } = await launch()
  try {
    await resize(app, win, 1440, 560)
    await openWorkspace(win)
    await win.locator('.xterm').first().click()
    await run(win, 'git status --short')
    await run(win, 'git diff --stat')
    await run(win, 'git checkout release')
    await run(win, 'node --test --test-reporter=dot', 3000)
    await palette(win, 'Split right')
    await win.waitForTimeout(2500)
    await win.locator('.xterm:visible').nth(1).click()
    await run(win, 'cd demo-shop')
    await run(win, 'git log --oneline')
    await run(win, 'cat src/discount.js')
    await win.locator('.block-gutter').nth(1).click()
    await park(win)
    await shot(win, 'blocks')
  } finally {
    await quit(app)
  }
})

test('editor', async () => {
  test.setTimeout(180_000)
  const { app, win } = await launch()
  try {
    await resize(app, win, 1440, 560)
    await openWorkspace(win)
    await win.locator('.topbar').getByRole('button', { name: 'Files', exact: true }).click()
    await win.locator('.file-tree').getByRole('button', { name: 'src', exact: true }).click()
    await win.locator('.xterm:visible').first().click()
    await run(win, 'pine git open README.md', 3500)
    await park(win)
    await shot(win, 'diff')
  } finally {
    await quit(app)
  }
})

test('cli', async () => {
  test.setTimeout(180_000)
  const { app, win } = await launch()
  try {
    await resize(app, win, 1000, 640)
    await openWorkspace(win)
    await win.locator('.xterm').first().click()
    await run(win, 'pine process run "node src/server.js" --name storefront', 3000)
    await win.keyboard.type('pine browse open http://127.0.0.1:4173', { delay: 8 })
    await win.keyboard.press('Enter')
    const card = win.getByRole('region', { name: 'Agent permission request' })
    await expect(card).toBeVisible({ timeout: 15_000 })
    await park(win)
    await shot(win, 'approval')
    await resize(app, win, 1440, 560)
    await card.getByRole('button', { name: 'Allow for this pane' }).click()
    await win.waitForTimeout(4000)
    await win.locator('.xterm:visible').first().click()
    await run(win, 'pine browse snapshot -i', 3000)
    await run(win, 'pine browse find role button click --name "Add to cart"', 3000)
    await win.locator('.xterm:visible').first().click()
    await run(win, 'pine browse get text "#count"', 3000)
    await park(win)
    await shot(win, 'browser')
  } finally {
    await quit(app)
  }
})

test('market', async () => {
  test.setTimeout(180_000)
  const { app, win } = await launch()
  try {
    await openWorkspace(win)
    await win.locator('.topbar').getByRole('button', { name: 'Settings' }).click()
    const settings = win.getByRole('region', { name: 'Settings' })
    await settings.getByRole('button', { name: 'Extensions', exact: true }).click()
    await settings.getByRole('textbox', { name: 'Marketplace repository' }).fill('aurigax-ai/pine-extensions')
    await settings.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(settings.getByRole('button', { name: 'Install', exact: true }).first()).toBeVisible({ timeout: 60_000 })
    await park(win)
    await shot(win, 'extensions')
  } finally {
    await quit(app)
  }
})

test('sandbox', async () => {
  test.setTimeout(180_000)
  const { app, win } = await launch()
  try {
    await resize(app, win, 1180, 700)
    await openWorkspace(win)
    await win.locator('.rail-row').first().click({ button: 'right' })
    await win.getByRole('menuitemcheckbox', { name: 'Sandbox' }).click()
    const restart = win.getByRole('button', { name: 'Restart to apply' })
    await restart.click()
    await expect(restart).toHaveCount(0)
    await win.waitForTimeout(3000)
    await win.locator('.rail-row').first().click({ button: 'right' })
    await win.getByRole('menuitem', { name: 'Workspace settings…' }).click()
    const page = win.getByRole('region', { name: 'Settings' })
    await page.getByRole('tab', { name: 'Network' }).click()
    await page.getByRole('group', { name: 'Never ask about other domains' }).getByRole('switch').click()
    await win.keyboard.press('Escape')
    await win.locator('.xterm').first().click()
    await run(win, 'curl -sS -m 10 https://example.com/', 5000)
    await run(win, 'curl -sS -m 10 https://example.org/', 5000)
    await park(win)
    await shot(win, 'sandbox-terminal')
    await win.locator('.rail-row').first().click({ button: 'right' })
    await win.getByRole('menuitem', { name: 'Workspace settings…' }).click()
    await page.getByRole('tab', { name: 'Blocked' }).click()
    await park(win)
    await shot(win, 'sandbox')
  } finally {
    await quit(app)
  }
})
