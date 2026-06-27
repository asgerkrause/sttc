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

export function fetchPath(pathname) {
  return `/routes/${slugFromPath(pathname)}.html`
}

export function isAssetPath(path) {
  return (
    path.startsWith('/routes/') ||
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
