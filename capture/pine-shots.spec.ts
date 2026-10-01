import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type ElectronApplication, type Page, _electron as electron, expect, test } from '@playwright/test'
import { DOM_RENDERER_SETTINGS, freshDataHome, isolatedLaunch, seedSettings } from './dataHome'
import { PROMPT, openWorkspace } from './helpers'
import { PROJECTS, seedHome } from './pine-shots.demo'

const OUT = '/tmp/pine-shots'
const HOME = '/tmp/home/dev'
const TEMPLATE = '/tmp/pine-shots-template'
const THEME = process.env.SHOT_THEME ?? 'oxocarbon'
const WIDTH = 1440
const HEIGHT = 900
const GROUPS: Record<string, string> = {
  'marlow-api': 'Marlow',
  'marlow-web': 'Marlow',
  'marlow-sdk': 'Marlow',
  'harbor-infra': 'Platform',
  tidepool: 'Platform',
}

function settings(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...DOM_RENDERER_SETTINGS,
    appearance: { theme: THEME },
    panes: { dimInactive: false },
    workspaces: { ...DOM_RENDERER_SETTINGS.workspaces, defaultFolder: join(HOME, PROJECTS[0]) },
    ...extra,
  }
}

function resetHome(): void {
  rmSync('/tmp/home', { recursive: true, force: true })
  seedHome(HOME)
}

async function launchIn(dataHome: string) {
  const options = isolatedLaunch(dataHome)
  const app = await electron.launch({
    ...options,
    args: ['--force-device-scale-factor=2', ...options.args],
    env: { ...options.env, HOME, XDG_CONFIG_HOME: join(HOME, '.config'), SHELL: '/usr/bin/zsh' },
  })
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')
  await app.evaluate(
    ({ BrowserWindow }, size) => {
      const w = BrowserWindow.getAllWindows()[0]
      w.setPosition(0, 0)
      w.setContentSize(size.width, size.height)
    },
    { width: WIDTH, height: HEIGHT },
  )
  await win.waitForTimeout(800)
  return { app, win }
}

async function quit(app: ElectronApplication) {
  const page = app.windows()[0]
  if (process.env.SHOT_DEBUG && page) await page.screenshot({ path: join(OUT, `debug-${test.info().title}.png`) }).catch(() => {})
  await app.evaluate(({ app: a }) => { setTimeout(() => a.quit(), 0) }).catch(() => {})
  await app.close().catch(() => {})
}

function term(win: Page) {
  return win.locator('.xterm:visible').first()
}

async function prompt(win: Page) {
  await expect(win.locator('.xterm-rows:visible').first()).toContainText(PROMPT, { timeout: 20_000 })
}

async function run(win: Page, line: string, wait = 1200) {
  await win.keyboard.type(line, { delay: 6 })
  await win.keyboard.press('Enter')
  await win.waitForTimeout(wait)
}

async function buildTemplate() {
  rmSync(TEMPLATE, { recursive: true, force: true })
  mkdirSync(TEMPLATE, { recursive: true })
  resetHome()
  seedSettings(TEMPLATE, settings({ approvals: { mode: 'allow' } }))
  const { app, win } = await launchIn(TEMPLATE)
  try {
    await openWorkspace(win)
    for (const [index, project] of PROJECTS.entries()) {
      if (index > 0) {
        await term(win).click()
        await run(win, `pine workspace.new '{"dir":"${join(HOME, project)}"}'`, 1500)
        await win.locator('.workspace-empty:visible').getByRole('button', { name: 'New terminal' }).click()
        await prompt(win)
      }
      const group = GROUPS[project]
      if (group) {
        await term(win).click()
        await run(win, `pine workspace group ${group}`, 1000)
      }
    }
    await win.evaluate(() => localStorage.setItem('railWidth', '292'))
    await win.waitForTimeout(2500)
  } finally {
    await quit(app)
  }
  rmSync(join(TEMPLATE, 'pine', 'scrollback.json'), { force: true })
}

async function launch(extra: Record<string, unknown> = {}) {
  if (!existsSync(join(TEMPLATE, 'pine', 'workspaces.json'))) await buildTemplate()
  const dataHome = freshDataHome()
  cpSync(TEMPLATE, dataHome, { recursive: true })
  resetHome()
  seedSettings(dataHome, settings(extra))
  const launched = await launchIn(dataHome)
  await expect(launched.win.locator('.rail-row')).toHaveCount(PROJECTS.length, { timeout: 20_000 })
  return { ...launched, dataHome }
}

async function goto(win: Page, project: string) {
  await win.locator('.rail-row', { hasText: project }).first().click()
  await prompt(win)
  await term(win).click()
}

async function agent(win: Page, project: string, line: string, until: string | RegExp) {
  await goto(win, project)
  await run(win, line, 400)
  await expect(win.locator('.xterm-rows:visible').first()).toContainText(until, { timeout: 30_000 })
}

async function park(win: Page) {
  await win.mouse.move(WIDTH / 2, HEIGHT - 60)
}

async function shot(win: Page, name: string) {
  await park(win)
  await win.waitForTimeout(900)
  mkdirSync(OUT, { recursive: true })
  await win.screenshot({ path: join(OUT, `${name}.png`) })
}

async function busyDay(win: Page) {
  await agent(win, 'harbor-infra', 'claude "plan the Postgres 16 upgrade for staging"', 'Refreshing state')
  await goto(win, 'tidepool')
  await run(win, 'uv run pytest -q', 300)
  await agent(win, 'marlow-sdk', 'claude "write the 2.4.0 release notes"', '1 deprecation')
  await goto(win, 'handbook')
  await run(win, 'git log --oneline', 800)
}

async function palette(win: Page, title: string) {
  await win.keyboard.press('Control+Shift+P')
  await win.keyboard.type(title, { delay: 10 })
  await win.waitForTimeout(600)
  await win.keyboard.press('Enter')
  await win.waitForTimeout(1200)
}

const AGENTS_VIEW = {
  version: 1,
  title: 'Agents',
  placement: 'sidebar',
  icon: 'robot',
  root: {
    type: 'stack',
    gap: 'sm',
    children: [
      {
        type: 'list',
        for: 'workspaces',
        as: 'ws',
        gap: 'sm',
        item: {
          type: 'row',
          justify: 'between',
          children: [
            { type: 'text', text: '{{ws.name}}', size: 'sm', truncate: true },
            { type: 'badge', text: '{{ws.state}}', tone: 'muted' },
          ],
        },
      },
      {
        type: 'button',
        label: 'New scratch workspace',
        icon: 'plus',
        variant: 'outline',
        action: { command: 'workspace.newScratch' },
      },
    ],
  },
}

test('hero', async () => {
  test.setTimeout(300_000)
  const { app, win } = await launch()
  try {
    await busyDay(win)
    await agent(win, 'marlow-web', 'codex "the invoice table overflows at 1280px"', 'pine browse open')
    await agent(win, 'marlow-api', 'claude "make POST /invoices idempotent"', 'Apply it to the dev database')
    await win.waitForTimeout(6000)
    await shot(win, 'hero')
    await win.locator('.topbar').getByRole('button', { name: /Notifications/ }).click()
    await win.waitForTimeout(800)
    await win.screenshot({ path: join(OUT, 'notifications.png') })
  } finally {
    await quit(app)
  }
})

test('browser', async () => {
  test.setTimeout(300_000)
  const { app, win } = await launch()
  try {
    await busyDay(win)
    await agent(win, 'marlow-api', 'claude "make POST /invoices idempotent"', 'Apply it to the dev database')
    await agent(win, 'marlow-web', 'codex "the invoice table overflows at 1280px"', 'pine browse open')
    const card = win.getByRole('region', { name: 'Agent permission request' })
    await expect(card).toBeVisible({ timeout: 15_000 })
    await shot(win, 'approval')
    await card.getByRole('button', { name: 'Allow for this pane' }).click()
    await expect(win.locator('.xterm-rows:visible').first()).toContainText('Ready for you to look', { timeout: 40_000 })
    for (const width of [WIDTH + 2, WIDTH]) {
      await app.evaluate(({ BrowserWindow }, size) => {
        BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height)
      }, { width, height: HEIGHT })
      await win.waitForTimeout(1500)
    }
    await shot(win, 'browser')
  } finally {
    await quit(app)
  }
})

test('review', async () => {
  test.setTimeout(300_000)
  const { app, win } = await launch()
  try {
    await busyDay(win)
    await goto(win, 'marlow-api')
    await run(win, 'git status --short', 800)
    await run(win, 'pine git show', 2500)
    await win.mouse.click(927, 318)
    await win.waitForTimeout(2500)
    await shot(win, 'review')
  } finally {
    await quit(app)
  }
})

test('view', async () => {
  test.setTimeout(300_000)
  const { app, win } = await launch()
  try {
    const views = join(HOME, '.config', 'pine', 'views')
    mkdirSync(views, { recursive: true })
    writeFileSync(join(views, 'agents.json'), `${JSON.stringify(AGENTS_VIEW, null, 2)}\n`)
    await busyDay(win)
    await agent(win, 'marlow-web', 'codex "the invoice table overflows at 1280px"', 'pine browse open')
    await win.locator('.topbar').getByRole('button', { name: 'Settings' }).click()
    const page = win.getByRole('region', { name: 'Settings' })
    await page.getByRole('button', { name: 'Views', exact: true }).click()
    await page.locator('[data-view-row="agents"]').getByRole('switch', { name: 'Show Agents' }).click()
    await shot(win, 'views-settings')
    await win.keyboard.press('Escape')
    await goto(win, 'handbook')
    await run(win, 'pine open ~/.config/pine/views/agents.json', 3000)
    await shot(win, 'view')
  } finally {
    await quit(app)
  }
})

test('appearance', async () => {
  test.setTimeout(300_000)
  const { app, win } = await launch()
  try {
    await win.locator('.topbar').getByRole('button', { name: 'Settings' }).click()
    const page = win.getByRole('region', { name: 'Settings' })
    await page.getByRole('button', { name: 'Appearance', exact: true }).click()
    await shot(win, 'appearance')
    await page.getByRole('button', { name: 'Extensions', exact: true }).click()
    await shot(win, 'extensions')
  } finally {
    await quit(app)
  }
})

test('sandbox', async () => {
  test.setTimeout(300_000)
  const { app, win } = await launch()
  try {
    await busyDay(win)
    await goto(win, 'tidepool')
    const row = win.locator('.rail-row', { hasText: 'tidepool' }).first()
    await row.click({ button: 'right' })
    await win.getByRole('menuitemcheckbox', { name: 'Sandbox' }).click()
    const restart = win.getByRole('button', { name: 'Restart to apply' })
    await restart.click()
    await expect(restart).toHaveCount(0)
    await win.waitForTimeout(3000)
    await term(win).click()
    await run(win, 'clear', 800)
    await run(win, 'cat ~/.ssh/id_ed25519', 1500)
    await run(win, 'curl -sS -m 60 https://api.stripe.com/v1/balance', 500)
    const card = win.getByRole('region', { name: 'Agent permission request' })
    await expect(card).toBeVisible({ timeout: 20_000 })
    await shot(win, 'sandbox')
    await card.getByRole('button', { name: 'Deny' }).click()
  } finally {
    await quit(app)
  }
})

test('cards', async () => {
  test.setTimeout(300_000)
  const { app, win } = await launch()
  try {
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setContentSize(880, 430)
    })
    await win.waitForTimeout(1500)
    await goto(win, 'tidepool')
    const row = win.locator('.rail-row', { hasText: 'tidepool' }).first()
    await row.click({ button: 'right' })
    await win.getByRole('menuitemcheckbox', { name: 'Sandbox' }).click()
    const restart = win.getByRole('button', { name: 'Restart to apply' })
    await restart.click()
    await expect(restart).toHaveCount(0)
    await win.waitForTimeout(3000)
    await term(win).click()
    await run(win, 'clear', 800)
    await run(win, 'cat ~/.ssh/id_ed25519', 1500)
    await run(win, 'curl -sS -m 60 https://api.stripe.com/v1/balance', 500)
    const card = win.getByRole('region', { name: 'Agent permission request' })
    await expect(card).toBeVisible({ timeout: 20_000 })
    await win.mouse.move(600, 200)
    await win.waitForTimeout(900)
    await win.screenshot({ path: join(OUT, 'sandbox-card.png') })
    await card.getByRole('button', { name: 'Deny' }).click()
    await agent(win, 'marlow-web', 'codex "the invoice table overflows at 1280px"', 'pine browse open')
    await expect(card).toBeVisible({ timeout: 15_000 })
    await win.mouse.move(600, 200)
    await win.waitForTimeout(900)
    await win.screenshot({ path: join(OUT, 'approval-card.png') })
  } finally {
    await quit(app)
  }
})
