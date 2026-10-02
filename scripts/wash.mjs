import sharp from 'sharp'

const [source, target, grainKind = 'white', widthArg] = process.argv.slice(2)
const GRAINS = {
  white: { speckle: (noise) => noise.greyscale().linear(2, -256), blend: 'screen' },
  color: { speckle: (noise) => noise, blend: 'overlay' },
  mono: { speckle: (noise) => noise.greyscale(), blend: 'overlay' },
}
const grainStyle = GRAINS[grainKind]
if (!source || !target || !grainStyle) {
  console.error('usage: node scripts/wash.mjs <image> <output.webp> [white|color|mono] [width]')
  process.exit(1)
}

const WIDTH = Number(widthArg ?? 2000)
const HEIGHT = Math.round((WIDTH * 5) / 8)
const SATURATION = 0.75
const CONTRAST = 0.78
const LIFT = 28
const TINT = { r: 118, g: 128, b: 124 }
const TINT_STRENGTH = 0.12
const GRAIN_SIGMA = 44
const GRAIN_STRENGTH = 0.8
const GRAIN_SIZE = 1.6

const washed = await sharp(source)
  .resize(WIDTH, HEIGHT, { fit: 'cover', kernel: 'lanczos3' })
  .blur(1.2)
  .modulate({ saturation: SATURATION })
  .linear(CONTRAST, LIFT)
  .composite([
    {
      input: {
        create: { width: WIDTH, height: HEIGHT, channels: 4, background: { ...TINT, alpha: TINT_STRENGTH } },
      },
      blend: 'over',
    },
  ])
  .png()
  .toBuffer()

const noise = await grainStyle
  .speckle(
    sharp({
      create: {
        width: Math.round(WIDTH / GRAIN_SIZE),
        height: Math.round(HEIGHT / GRAIN_SIZE),
        channels: 3,
        background: { r: 128, g: 128, b: 128 },
        noise: { type: 'gaussian', mean: 128, sigma: GRAIN_SIGMA },
      },
    }),
  )
  .png()
  .toBuffer()

const grain = await sharp(noise)
  .resize(WIDTH, HEIGHT, { kernel: 'cubic' })
  .ensureAlpha(GRAIN_STRENGTH)
  .png()
  .toBuffer()

await sharp(washed)
  .composite([{ input: grain, blend: grainStyle.blend }])
  .webp({ quality: 76 })
  .toFile(target)

console.log(`washed ${source} into ${target} (${WIDTH}x${HEIGHT}, ${grainKind} grain)`)
