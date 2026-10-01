import arrowRight from '@phosphor-icons/core/assets/regular/arrow-right.svg?raw'
import arrowUpRight from '@phosphor-icons/core/assets/regular/arrow-up-right.svg?raw'
import downloadSimple from '@phosphor-icons/core/assets/regular/download-simple.svg?raw'
import githubLogo from '@phosphor-icons/core/assets/regular/github-logo.svg?raw'
import magnifyingGlass from '@phosphor-icons/core/assets/regular/magnifying-glass.svg?raw'
import { SafeHtml } from './html'

const ICONS = {
  'arrow-right': arrowRight,
  'arrow-up-right': arrowUpRight,
  download: downloadSimple,
  github: githubLogo,
  search: magnifyingGlass,
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
