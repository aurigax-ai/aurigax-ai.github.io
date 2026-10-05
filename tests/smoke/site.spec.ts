import { readFileSync } from 'node:fs'
import { type Page, expect, test } from '@playwright/test'

const release = JSON.parse(readFileSync(new URL('../fixtures/release.json', import.meta.url), 'utf8'))

async function stubGitHub(page: Page): Promise<void> {
  await page.route('https://api.github.com/**', (route) => {
    if (route.request().url().endsWith('/repos/aurigax-ai/ostia/releases/latest')) {
      return route.fulfill({ json: release })
    }
    return route.fulfill({ status: 404, json: { message: 'Not Found' } })
  })
}

async function failGitHub(page: Page): Promise<void> {
  await page.route('https://api.github.com/**', (route) =>
    route.fulfill({ status: 403, json: { message: 'API rate limit exceeded' } }),
  )
}

function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

test.describe('with GitHub answering', () => {
  test('home shows the product, its screenshots and working links', async ({ page, request }) => {
    const errors = watchErrors(page)
    await stubGitHub(page)
    await page.goto('./')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('One workspace for you and your coding agents.')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://aurigax-ai.github.io/',
    )
    const images = page.locator('main img:not([alt=""])')
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
    await expect(page).toHaveURL(/\/download\/$/)
    expect(errors).toEqual([])
  })

  test('the hero tabs swap the capture and its caption', async ({ page }) => {
    const errors = watchErrors(page)
    await stubGitHub(page)
    await page.goto('./')
    const panel = page.getByRole('tabpanel')
    await expect(page.getByRole('tab', { name: 'Run agents' })).toHaveAttribute('aria-selected', 'true')
    await expect(panel.getByRole('img')).toHaveAttribute('alt', /sidebar lists six projects/)
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0)
    await page.getByRole('tab', { name: 'Drive the browser' }).click()
    await expect(panel).toHaveCount(1)
    await expect(panel.getByRole('img')).toHaveAttribute('alt', /browser pane shows the invoices page/)
    await expect(page.getByText('opens its page in a browser inside Ostia')).toBeVisible()
    await page.getByRole('tab', { name: 'Approve' }).press('Enter')
    await expect(panel).toHaveCount(1)
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
    await expect(region).toContainText('ostia-9.8.7.AppImage, 153 MB')
    await expect(region.getByRole('link', { name: 'Get the AppImage' })).toHaveAttribute(
      'href',
      'https://github.com/aurigax-ai/ostia/releases/download/v9.8.7/ostia-9.8.7.AppImage',
    )
    await expect(region.getByRole('link', { name: 'Get the tarball' })).toBeVisible()
    await expect(region).toContainText('ostia-9.8.7-arm64.dmg, 125 MB')
    await expect(region.getByRole('link', { name: 'Get the disk image' })).toHaveAttribute(
      'href',
      'https://github.com/aurigax-ai/ostia/releases/download/v9.8.7/ostia-9.8.7-arm64.dmg',
    )
    await expect(page.getByLabel('Homebrew commands')).toContainText('brew install --cask aurigax-ai/tap/ostia')
    await expect(page.locator('[data-file="dmg"]')).toHaveText('ostia-9.8.7-arm64.dmg')
    await expect(page.getByLabel('AppImage commands')).toContainText('chmod +x ostia-9.8.7.AppImage')
    await expect(page.getByLabel('Tarball commands')).toContainText('./ostia-9.8.7-linux-x64/pine')
    await expect(page.locator('#release-status')).toHaveText('Read from GitHub just now.')
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
      /^https:\/\/github\.com\/aurigax-ai\/ostia\/releases\/download\//,
    )
    await expect(page.getByRole('link', { name: 'All releases on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/aurigax-ai/ostia/releases',
    )
    expect(errors).toEqual([])
  })
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('home shows the first capture and every section', async ({ page }) => {
    await page.goto('./')
    await expect(page.getByRole('tabpanel').getByRole('img')).toHaveAttribute('alt', /sidebar lists six projects/)
    await expect(page.getByRole('heading', { name: 'See which agents need you' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Download Ostia for macOS and Linux' })).toBeVisible()
  })

  test('download renders the build-time snapshot', async ({ page }) => {
    await page.goto('download/')
    await expect(page.locator('#release [data-release]')).toBeVisible()
    await expect(page.getByRole('link', { name: 'All releases on GitHub' })).toBeVisible()
  })
})
