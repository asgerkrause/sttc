import { stat } from 'fs/promises'
import { extname, join, sep } from 'path'
import { isAssetPath } from './runtime/lib/paths.js'

const root = process.cwd()
const dist = join(root, 'dist')
const preferredPort = Number(process.env.PORT ?? 4173)
const hostname = process.env.HOST ?? '127.0.0.1'

const COMPRESSED = /\.(woff2?|png|jpe?g|webp|gif|avif|mp4|zip|gz)$/i
const ASSET_CACHE = 'public, max-age=31536000, immutable'
const HTML_CACHE = 'public, max-age=0, must-revalidate'

function typeOf(path: string) {
  const ext = extname(path).toLowerCase()
  if (ext === '.html') return 'text/html; charset=utf-8'
  if (ext === '.css') return 'text/css; charset=utf-8'
  if (ext === '.js') return 'text/javascript; charset=utf-8'
  if (ext === '.json') return 'application/json; charset=utf-8'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.xml') return 'application/xml; charset=utf-8'
  if (ext === '.txt' || ext === '.md') return 'text/plain; charset=utf-8'
  if (ext === '.woff') return 'font/woff'
  if (ext === '.woff2') return 'font/woff2'
  if (ext === '.webp') return 'image/webp'
  return undefined
}

function cacheControl(path: string) {
  if (path.startsWith('/assets/')) return ASSET_CACHE
  if (path.endsWith('.html') || path === '/') return HTML_CACHE
  return 'public, max-age=3600'
}

function wantsGzip(req: Request, path: string, type: string | undefined) {
  if (COMPRESSED.test(path)) return false
  if (!req.headers.get('accept-encoding')?.includes('gzip')) return false
  if (!type) return false
  return type.startsWith('text/') || type.includes('javascript') || type.includes('json') || type === 'image/svg+xml'
}

async function fileResponse(req: Request, urlPath: string, status = 200) {
  const abs = join(dist, urlPath)
  if (!abs.startsWith(dist + sep)) return null
  const file = Bun.file(abs)
  if (!(await file.exists())) return null
  const type = typeOf(urlPath) ?? file.type
  const headers: Record<string, string> = {
    'Cache-Control': cacheControl(urlPath),
  }
  if (type) headers['Content-Type'] = type
  if (wantsGzip(req, urlPath, type)) {
    const bytes = Buffer.from(await file.arrayBuffer())
    headers['Content-Encoding'] = 'gzip'
    headers['Vary'] = 'Accept-Encoding'
    return new Response(Bun.gzipSync(bytes), { status, headers })
  }
  return new Response(file, { status, headers })
}

async function handleRequest(req: Request) {
  const url = new URL(req.url)
  let path = decodeURIComponent(url.pathname)
  if (path.endsWith('/')) path = path.slice(0, -1) || '/'
  const filePath = path === '/' ? '/index.html' : path
  const candidates = filePath.endsWith('.html') ? [filePath] : [filePath, `${filePath}.html`, `${filePath}/index.html`]
  for (const candidate of candidates) {
    const response = await fileResponse(req, candidate)
    if (response) return response
  }
  if (isAssetPath(path)) return new Response('Not found', { status: 404 })
  const notFound = await fileResponse(req, '/404/index.html', 404)
  if (notFound) return notFound
  return new Response('Not found', { status: 404 })
}

if (!(await stat(dist).then((entry) => entry.isDirectory()).catch(() => false))) {
  console.error('No dist/. Run bun run build first.')
  process.exit(1)
}

for (let port = preferredPort; port < preferredPort + 20; port++) {
  try {
    const server = Bun.serve({ hostname, port, fetch: handleRequest })
    console.log(`preview http://${server.hostname}:${server.port}`)
    break
  } catch (err) {
    const code = typeof err === 'object' && err && 'code' in err ? String(err.code) : ''
    if (code !== 'EADDRINUSE' || port === preferredPort + 19) throw err
  }
}
