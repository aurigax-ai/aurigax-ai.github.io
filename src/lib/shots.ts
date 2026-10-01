import type { ImageMetadata } from 'astro'
import { getImage } from 'astro:assets'

export interface ShotSources {
  src: string
  srcset: string
  width: number
  height: number
}

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/shots/*.png', { eager: true })
const WIDTHS = [480, 720, 960, 1280, 1680, 2240]

export async function shotSources(name: string): Promise<ShotSources> {
  const file = files[`../assets/shots/${name}.png`]
  if (!file) throw new Error(`missing capture ${name}.png`)
  const image = file.default
  const widths = [...WIDTHS.filter((width) => width < image.width), image.width]
  const variants = await Promise.all(
    widths.map(async (width) => {
      const result = await getImage({ src: image, width, format: 'webp', quality: 84 })
      return { width, url: result.src }
    }),
  )
  return {
    src: variants[Math.min(2, variants.length - 1)]?.url ?? '',
    srcset: variants.map((variant) => `${variant.url} ${variant.width}w`).join(', '),
    width: image.width / 2,
    height: image.height / 2,
  }
}
