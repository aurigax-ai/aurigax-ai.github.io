import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const root = new URL('../', import.meta.url)
const data = (path, type) => `data:${type};base64,${readFileSync(new URL(path, root)).toString('base64')}`
const font = data('node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2', 'font/woff2')
const icon = data('src/assets/icon.svg', 'image/svg+xml')
const hero = data('src/assets/shots/hero.png', 'image/png')
const targets = [
  { path: new URL('public/og.png', root).pathname, width: 1200, height: 630 },
  ...(process.argv[2] ? [{ path: process.argv[2], width: 1280, height: 640 }] : []),
]

const page = `<!doctype html>
<style>
  @font-face { font-family: Geist; src: url(${font}) format('woff2'); font-weight: 100 900; }
  * { box-sizing: border-box; margin: 0; }
  body { width: 100vw; height: 100vh; overflow: hidden; background: #161616; color: #f2f4f8; font-family: Geist, sans-serif; }
  header { position: absolute; left: 6vw; top: 9vh; display: flex; align-items: center; gap: 1.4vw; font-size: 3.3vw; font-weight: 600; letter-spacing: -0.02em; }
  header img { width: 4.6vw; height: 4.6vw; border-radius: 1vw; }
  h1 { position: absolute; left: 6vw; top: 26vh; width: 86vw; font-size: 4.7vw; font-weight: 500; line-height: 1.08; letter-spacing: -0.03em; }
  .shot { position: absolute; left: 6vw; top: 55vh; width: 108vw; border-radius: 1vw; box-shadow: 0 0 0 1px rgb(255 255 255 / 0.1), 0 3vw 6vw rgb(0 0 0 / 0.6); }
</style>
<header><img src="${icon}" alt="" />Pine</header>
<h1>One workspace for you and every coding agent you run.</h1>
<img class="shot" src="${hero}" alt="" />`

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' })
for (const target of targets) {
  const tab = await browser.newPage({ viewport: { width: target.width, height: target.height } })
  await tab.setContent(page, { waitUntil: 'networkidle' })
  await tab.evaluate(() => document.fonts.ready)
  await tab.screenshot({ path: target.path })
  await tab.close()
  console.log(`wrote ${target.path}`)
}
await browser.close()
