import { writeFileSync } from 'node:fs'

const APP_REPO = 'aurigax-ai/pine'
const MARKETPLACE_REPO = 'aurigax-ai/pine-extensions'
const dataDir = new URL('../src/data/', import.meta.url)
const headers = { 'user-agent': 'pine-website-snapshot', accept: 'application/vnd.github+json' }
if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`

async function json(url, withHeaders = false) {
  const response = await fetch(url, withHeaders ? { headers } : undefined)
  if (!response.ok) throw new Error(`${response.status} for ${url}`)
  return response.json()
}

function write(name, value) {
  writeFileSync(new URL(name, dataDir), `${JSON.stringify(value, null, 2)}\n`)
}

async function snapshotMarketplace() {
  const { default_branch: branch } = await json(`https://api.github.com/repos/${MARKETPLACE_REPO}`, true)
  const raw = (path) => `https://raw.githubusercontent.com/${MARKETPLACE_REPO}/${branch}/${path}`
  const marketplace = await json(raw('pine-marketplace.json'))
  const manifests = {}
  for (const path of Array.isArray(marketplace.extensions) ? marketplace.extensions : []) {
    if (typeof path !== 'string') continue
    manifests[path] = await json(raw(`${path}/pine.json`)).catch(() => null)
  }
  write('marketplace.snapshot.json', {
    repo: MARKETPLACE_REPO,
    branch,
    fetchedAt: new Date().toISOString(),
    marketplace,
    manifests,
  })
  console.log(`marketplace: ${Object.keys(manifests).length} extension(s) from ${branch}`)
}

async function snapshotRelease() {
  const release = await json(`https://api.github.com/repos/${APP_REPO}/releases/latest`, true)
  write('release.snapshot.json', {
    fetchedAt: new Date().toISOString(),
    release: {
      tag_name: release.tag_name,
      html_url: release.html_url,
      published_at: release.published_at,
      draft: release.draft,
      prerelease: release.prerelease,
      assets: release.assets.map(({ name, size, browser_download_url }) => ({
        name,
        size,
        browser_download_url,
      })),
    },
  })
  console.log(`release: ${release.tag_name}`)
}

let failed = false
for (const task of [snapshotMarketplace, snapshotRelease]) {
  try {
    await task()
  } catch (error) {
    failed = true
    console.error(`${task.name} kept the committed snapshot: ${error.message}`)
  }
}
process.exit(failed && process.env.SNAPSHOT_STRICT === '1' ? 1 : 0)
