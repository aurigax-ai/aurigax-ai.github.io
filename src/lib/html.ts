const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ENTITIES[char] ?? char)
}

export class SafeHtml {
  constructor(readonly value: string) {}
  toString(): string {
    return this.value
  }
}

type Part = SafeHtml | string | number | null | undefined | false | Part[]

function render(part: Part): string {
  if (part === null || part === undefined || part === false) return ''
  if (Array.isArray(part)) return part.map(render).join('')
  if (part instanceof SafeHtml) return part.value
  return escapeHtml(part)
}

export function html(strings: TemplateStringsArray, ...parts: Part[]): SafeHtml {
  let out = strings[0] ?? ''
  parts.forEach((part, index) => {
    out += render(part) + (strings[index + 1] ?? '')
  })
  return new SafeHtml(out)
}

export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}
