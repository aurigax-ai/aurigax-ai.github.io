const base = import.meta.env.BASE_URL.replace(/\/+$/, '')

export function href(path: string): string {
  const clean = path.replace(/^\/+/, '')
  return clean ? `${base}/${clean}` : `${base}/`
}
