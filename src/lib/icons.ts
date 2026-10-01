import arrowUpRight from '@phosphor-icons/core/assets/regular/arrow-up-right.svg?raw'
import downloadSimple from '@phosphor-icons/core/assets/regular/download-simple.svg?raw'
import githubLogo from '@phosphor-icons/core/assets/regular/github-logo.svg?raw'
import { SafeHtml } from './html'

const ICONS = {
  'arrow-up-right': arrowUpRight,
  download: downloadSimple,
  github: githubLogo,
}

export type IconName = keyof typeof ICONS

export function icon(name: IconName, size = 18): SafeHtml {
  return new SafeHtml(
    ICONS[name].replace(
      '<svg ',
      `<svg aria-hidden="true" focusable="false" width="${size}" height="${size}" style="flex:none" `,
    ),
  )
}
