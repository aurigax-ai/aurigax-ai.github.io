import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const source = process.argv[2]
if (!source) {
  console.error('usage: node scripts/import-shots.mjs <folder with captures>')
  process.exit(1)
}

const target = new URL('../src/assets/shots/', import.meta.url).pathname
const DENSITY = 2
const SHOTS = {
  hero: { from: 'hero' },
  browser: { from: 'browser' },
  review: { from: 'review' },
  approval: { from: 'approval' },
  rail: { from: 'hero', crop: [0, 36, 292, 524] },
  notifications: { from: 'notifications', crop: [984, 40, 336, 460] },
  'see-tab': { from: 'browser', crop: [292, 36, 574, 236] },
  'see-browser': { from: 'browser', crop: [866, 36, 574, 236] },
  'see-diff': { from: 'hero', crop: [866, 286, 574, 236] },
  'see-state': { from: 'hero', crop: [0, 36, 574, 236] },
  'approval-card': { from: 'approval-card', crop: [292, 36, 588, 444] },
  'sandbox-card': { from: 'sandbox-card', crop: [292, 36, 588, 444] },
  pick: { from: 'pick-panel', crop: [866, 36, 574, 480] },
  select: { from: 'select-panel', crop: [292, 36, 574, 480] },
  'view-json': { from: 'view', crop: [292, 36, 438, 470] },
  'view-rail': { from: 'view', crop: [0, 690, 292, 210] },
  themes: { from: 'appearance', crop: [600, 56, 740, 434] },
}

rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })
const files = readdirSync(source)

for (const [name, shot] of Object.entries(SHOTS)) {
  const file = `${shot.from}.png`
  if (!files.includes(file)) throw new Error(`missing ${file}`)
  let image = sharp(join(source, file))
  if (shot.crop) {
    const [left, top, width, height] = shot.crop.map((value) => value * DENSITY)
    image = image.extract({ left, top, width, height })
  }
  await image.png({ compressionLevel: 9 }).toFile(join(target, `${name}.png`))
}

console.log(`imported ${Object.keys(SHOTS).length} captures into ${target}`)
