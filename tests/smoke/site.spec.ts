import { readFileSync } from 'node:fs'
import { type Page, expect, test } from '@playwright/test'

const release = JSON.parse(readFileSync(new URL('../fixtures/release.json', import.meta.url), 'utf8'))
const marketplace: Record<string, unknown> = JSON.parse(
  readFileSync(new URL('../fixtures/marketplace.json', import.meta.url), 'utf8'),
)
const RAW = 'https://raw.githubusercontent.com/aurigax-ai/pine-extensions/main/'

async function stubGitHub(page: Page): Promise<void> {
  await page.route('https://api.github.com/**', (route) => {
    if (route.request().url().endsWith('/repos/aurigax-ai/pine/releases/latest')) {
      return route.fulfill({ json: release })
    }
    return route.fulfill({ status: 404, json: { message: 'Not Found' } })
  })
  await page.route('https://raw.githubusercontent.com/**', (route) => {
    const file = route.request().url().replace(RAW, '')
    if (file in marketplace) return route.fulfill({ json: marketplace[file] })
    return route.fulfill({ status: 404, body: '404: Not Found' })
  })
}

async function failGitHub(page: Page): Promise<void> {
  await page.route('https://api.github.com/**', (route) =>
    route.fulfill({ status: 403, json: { message: 'API rate limit exceeded' } }),
  )
  await page.route('https://raw.githubusercontent.com/**', (route) => route.abort('failed'))
}

function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

test.describe('with GitHub answering', () => {
  test('home shows the product, its screenshots and working links under the base path', async ({ page, request }) => {
    const errors = watchErrors(page)
    await stubGitHub(page)
    await page.goto('./')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('One workspace for you and every coding agent you run.')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://aurigax-ai.github.io/pine-website/',
    )
    const images = page.locator('main img')
    expect(await images.count()).toBeGreaterThanOrEqual(7)
    for (const image of await images.all()) {
      expect(await image.getAttribute('alt')).toBeTruthy()
      expect(await image.getAttribute('width')).toBeTruthy()
      expect(await image.getAttribute('height')).toBeTruthy()
    }
    const hero = images.first()
    await expect.poll(() => hero.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0)
    for (const asset of ['favicon.svg', 'og.png', 'apple-touch-icon.png']) {
      expect((await request.get(asset)).status()).toBe(200)
    }
    await page.getByRole('main').getByRole('link', { name: 'Download' }).first().click()
    await expect(page).toHaveURL(/\/pine-website\/download\/$/)
    expect(errors).toEqual([])
  })

  test('the hero tabs swap the capture and its caption', async ({ page }) => {
    const errors = watchErrors(page)
    await stubGitHub(page)
    await page.goto('./')
    const panel = page.getByRole('tabpanel')
    await expect(page.getByRole('tab', { name: 'Run agents' })).toHaveAttribute('aria-selected', 'true')
    await expect(panel.getByRole('img')).toHaveAttribute('alt', /sidebar lists six projects/)
    await page.getByRole('tab', { name: 'Drive the browser' }).click()
    await expect(panel.getByRole('img')).toHaveAttribute('alt', /browser pane shows the invoices page/)
    await expect(panel).toContainText('opens the page in a browser pane')
    await page.getByRole('tab', { name: 'Approve' }).press('Enter')
    await expect(panel.getByRole('img')).toHaveAttribute('alt', /asks to drive the in-app browser/)
    expect(errors).toEqual([])
  })

  test('download shows the latest release read from the API', async ({ page }) => {
    const errors = watchErrors(page)
    await stubGitHub(page)
    await page.goto('download/')
    const region = page.locator('#release')
    await expect(region.locator('[data-release="9.8.7"]')).toBeVisible()
    await expect(region).toContainText('March 4, 2027')
    await expect(region).toContainText('pine-9.8.7.AppImage, 153 MB')
    await expect(region.getByRole('link', { name: 'Get the AppImage' })).toHaveAttribute(
      'href',
      'https://github.com/aurigax-ai/pine/releases/download/v9.8.7/pine-9.8.7.AppImage',
    )
    await expect(region.getByRole('link', { name: 'Get the tarball' })).toBeVisible()
    await expect(page.getByLabel('AppImage commands')).toContainText('chmod +x pine-9.8.7.AppImage')
    await expect(page.getByLabel('Tarball commands')).toContainText('./pine-9.8.7-linux-x64/pine')
    await expect(page.locator('#release-status')).toHaveText('Read from GitHub just now.')
    expect(errors).toEqual([])
  })

  test('extensions lists what the marketplace repository holds, as text, and filters it', async ({ page }) => {
    const errors = watchErrors(page)
    await stubGitHub(page)
    await page.goto('extensions/')
    const list = page.locator('#extensions')
    const weather = list.locator('[data-extension="weather"]')
    await expect(weather).toBeVisible()
    await expect(weather.getByRole('heading', { level: 3 })).toHaveText(
      'Weather <script>window.__pwned = true</script>',
    )
    await expect(weather).toContainText('Forecast chips for <b>every</b> pane')
    await expect(weather.locator('b')).toHaveCount(0)
    expect(await page.evaluate(() => '__pwned' in window)).toBe(false)
    await expect(weather).toContainText('2.0.0')
    await expect(weather).toContainText('notify')
    await expect(weather).toContainText('Pane chips')
    await expect(weather).toContainText('Holo decks')
    await expect(weather).toContainText('Bridge')
    await expect(list.locator('[data-extension="theme-pack"]')).toContainText('Aurora, Basalt')
    await expect(list.locator('[data-unavailable]')).toHaveCount(2)
    await expect(list.locator('[data-unavailable]').first()).toContainText('extensions/broken')
    await expect(page.locator('#extensions-status')).toContainText('2 extensions, read from')

    await page.getByLabel('Search extensions').fill('aurora')
    await expect(list.locator('[data-extension]')).toHaveCount(1)
    await expect(list.locator('[data-unavailable]')).toHaveCount(0)
    await page.getByLabel('Search extensions').fill('zzz')
    await expect(list.locator('[data-empty]')).toBeVisible()
    await page.getByLabel('Search extensions').fill('')
    await page.getByLabel('Category').selectOption({ label: 'Tools' })
    await expect(list.locator('[data-extension]')).toHaveCount(1)
    await expect(list.locator('[data-extension="weather"]')).toBeVisible()
    expect(errors).toEqual([])
  })
})

test.describe('with GitHub unreachable', () => {
  test('download keeps the release saved at build time and links to the releases page', async ({ page }) => {
    const errors = watchErrors(page)
    await failGitHub(page)
    await page.goto('download/')
    await expect(page.locator('#release-status')).toContainText('GitHub could not be reached')
    await expect(page.locator('#release [data-release]')).toBeVisible()
    await expect(page.locator('#release').getByRole('link', { name: 'Get the AppImage' })).toHaveAttribute(
      'href',
      /^https:\/\/github\.com\/aurigax-ai\/pine\/releases\/download\//,
    )
    await expect(page.getByRole('link', { name: 'All releases on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/aurigax-ai/pine/releases',
    )
    expect(errors).toEqual([])
  })

  test('extensions keeps the list saved at build time and still filters it', async ({ page }) => {
    const errors = watchErrors(page)
    await failGitHub(page)
    await page.goto('extensions/')
    await expect(page.locator('#extensions-status')).toContainText('GitHub could not be reached')
    const cards = page.locator('#extensions [data-extension]')
    expect(await cards.count()).toBeGreaterThan(0)
    await page.getByLabel('Search extensions').fill('no-such-extension-name')
    await expect(page.locator('#extensions [data-empty]')).toBeVisible()
    expect(errors).toEqual([])
  })
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('home shows the first capture and every section', async ({ page }) => {
    await page.goto('./')
    await expect(page.getByRole('tabpanel').getByRole('img')).toHaveAttribute('alt', /sidebar lists six projects/)
    await expect(page.getByRole('heading', { name: 'See which agent needs you' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pine runs on Linux today' })).toBeVisible()
  })

  test('download and extensions render the build-time snapshot', async ({ page }) => {
    await page.goto('download/')
    await expect(page.locator('#release [data-release]')).toBeVisible()
    await expect(page.getByRole('link', { name: 'All releases on GitHub' })).toBeVisible()
    await page.goto('extensions/')
    expect(await page.locator('#extensions [data-extension]').count()).toBeGreaterThan(0)
    await expect(page.locator('#filters')).toBeHidden()
  })
})
