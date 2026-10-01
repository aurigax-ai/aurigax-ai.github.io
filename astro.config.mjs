import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

const base = process.env.SITE_BASE ?? '/pine-website'

export default defineConfig({
  site: 'https://aurigax-ai.github.io',
  base,
  trailingSlash: 'always',
  build: { format: 'directory' },
  vite: { plugins: [tailwindcss()] },
})
