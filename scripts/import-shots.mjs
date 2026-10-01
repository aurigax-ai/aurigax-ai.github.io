import { mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const source = process.argv[2]
if (!source) {
  console.error('usage: node scripts/import-shots.mjs <folder with captures>')
  process.exit(1)
}

const target = new URL('../src/assets/shots/', import.meta.url).pathname
const publicDir = new URL('../public/', import.meta.url).pathname
const THEMES = { adeberry: 'dark', 'pine-light': 'light' }
const SCENES = ['hero', 'blocks', 'browser', 'diff', 'extensions', 'approval']
const CROPS = {
  sandbox: { name: 'sandbox', left: 900, top: 76, width: 1460, height: 560 },
}

mkdirSync(target, { recursive: true })
const files = readdirSync(source)

for (const [theme, mode] of Object.entries(THEMES)) {
  for (const scene of SCENES) {
    const file = `${scene}-${theme}.png`
    if (!files.includes(file)) throw new Error(`missing ${file}`)
    await sharp(join(source, file)).png({ compressionLevel: 9 }).toFile(join(target, `${scene}-${mode}.png`))
  }
  for (const [scene, crop] of Object.entries(CROPS)) {
    const { name, ...region } = crop
    await sharp(join(source, `${scene}-${theme}.png`))
      .extract(region)
      .png({ compressionLevel: 9 })
      .toFile(join(target, `${name}-${mode}.png`))
  }
}

await sharp(join(source, 'hero-adeberry.png'))
  .resize(1200, 630, { fit: 'cover', position: 'left top' })
  .png({ compressionLevel: 9 })
  .toFile(join(publicDir, 'og.png'))

console.log(`imported captures into ${target}`)
