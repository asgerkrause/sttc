// Shared path/slug normalization used by router (browser) and build (Node/Bun).
// Plain ESM JS so it imports cleanly from both worlds.

export function slugFromPath(pathname) {
  const path = pathname.replace(/\/$/, '') || '/'
  if (path === '/' || path === '/home') return 'index'
  return path.slice(1)
}

export function publicPath(pathname) {
  const path = pathname.replace(/\/$/, '') || '/'
  if (path === '/home') return '/'
  return pathname.endsWith('/') ? pathname : `${pathname}/`
}

export function isAssetPath(path) {
  return (
    path.startsWith('/assets/') ||
    path.startsWith('/lib/') ||
    path === '/router.js' ||
    /\.[a-z0-9]+$/i.test(path)
  )
}

export function slugFromRouteFile(filename) {
  return filename.replace(/\.html$/, '')
}

export function publicPathFromSlug(slug) {
  if (slug === 'index') return '/'
  return `/${slug}/`
}

/** Guessable markdown alias next to the public HTML URL. */
export function publicMarkdownPathFromSlug(slug) {
  if (slug === 'index') return '/index.md'
  return `/${slug}/index.md`
}

export function routeMarkdownPathFromSlug(slug) {
  return `/routes/${slug}.md`
}

export function routeJsonPathFromSlug(slug) {
  return `/routes/${slug}.json`
}
