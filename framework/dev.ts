import { watch } from 'fs'
import { stat as fsStat } from 'fs/promises'
import { basename, join } from 'path'
import { spawn } from 'bun'
import { isAssetPath } from './runtime/lib/paths.js'

const packageRoot = import.meta.dir
const root = process.cwd()
const src = join(root, 'src')
const dist = join(root, 'dist')
const preferredPort = Number(process.env.PORT ?? 3000)

let building = false
let dirty = false           // event arrived while we were building or absorbing — needs a build after the window
let buildCooldownUntil = 0
// macOS FSEvents fires many events per save. Content stamps reject read/duplicate echoes; genuine
// events during ECHO_ABSORB_MS are delayed until the current burst settles, never dropped.
const ECHO_ABSORB_MS = 2000
const DEBOUNCE_MS = 300

// SSE clients listening for build events
const sseClients = new Set<ReadableStreamDefaultController>()

function broadcast(event: string, data: unknown = {}) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const c of sseClients) {
    try { c.enqueue(payload) } catch {}
  }
}

async function runBuild() {
  if (building) {
    dirty = true
    return
  }
  building = true
  dirty = false
  broadcast('building')
  const proc = spawn(['bun', join(packageRoot, 'build', 'index.ts')], {
    cwd: root,
    stdout: 'inherit',
    stderr: 'inherit',
    env: { ...process.env, SNZ_DEV: '1' },
  })
  const code = await proc.exited
  building = false
  buildCooldownUntil = Date.now() + ECHO_ABSORB_MS
  if (code !== 0) {
    console.error('Build failed')
    broadcast('error')
  } else {
    broadcast('reload')
  }
  // Route every follow-up through the single debounce timer so one event cannot schedule two builds.
  if (dirty) {
    dirty = false
    scheduleBuild()
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined

function scheduleBuild() {
  if (building) {
    dirty = true
    return
  }
  // Do not drop genuine saves during the post-build absorb window. Content stamps filter read
  // echoes; a real event is queued for the earliest safe rebuild instead.
  clearTimeout(debounceTimer)
  const delay = Math.max(DEBOUNCE_MS, buildCooldownUntil - Date.now())
  debounceTimer = setTimeout(() => runBuild(), delay)
}

function shouldIgnoreWatch(filename: string | null) {
  if (!filename) return false
  const base = basename(filename)
  if (base === '.DS_Store' || base === '.gitkeep' || base.startsWith('.')) return true
  if (base === 'dist' || base.startsWith('dist.__')) return true
  if (base === '__build-error.html') return true
  return false
}

// macOS FSEvents reports atime-only changes (when the build reads source files) as
// "change" events. Track content-relevant stats per path and ignore events where kind, mtime,
// and size are unchanged — those are pure access-time noise.
const stamps = new Map<string, string>()
const missing = new Set<string>()

async function stamp(absPath: string): Promise<string | null> {
  try {
    const s = await fsStat(absPath)
    return `${s.isDirectory() ? 'd' : 'f'}:${s.mtimeMs}:${s.size}`
  } catch { return null }
}

async function looksLikeRealChange(absPath: string): Promise<boolean> {
  const next = await stamp(absPath)
  if (next === null) {
    // A deletion or directory rename is real once; duplicate kernel notifications are not.
    const wasKnown = stamps.delete(absPath)
    const firstMissingEvent = !missing.has(absPath)
    missing.add(absPath)
    return wasKnown || firstMissingEvent
  }
  missing.delete(absPath)
  const prev = stamps.get(absPath)
  if (prev === next) return false
  stamps.set(absPath, next)
  return true
}

function onWatch(watchRoot: string) {
  return async (_event: string, filename: string | null) => {
    if (shouldIgnoreWatch(filename)) return
    const abs = filename ? join(watchRoot, filename) : null
    if (abs && !(await looksLikeRealChange(abs))) {
      if (process.env.SNZ_WATCH_DEBUG) console.log(`[watch-skip] ${filename} (atime-only)`)
      return
    }
    if (process.env.SNZ_WATCH_DEBUG) console.log(`[watch] ${_event} ${filename}`)
    if (watchRoot === root || watchRoot === src) void ensureManagedWatchTrees()
    scheduleBuild()
  }
}

const HMR_CLIENT = `
// Full reload is intentional: shell, global CSS, and the hashed app bundle can all change in one
// build. A partial route swap could report success while leaving any of those assets stale.
(() => {
  if (window.__snzHmr) return; window.__snzHmr = true
  let reloading = false
  const es = new EventSource('/__snz/events')
  es.addEventListener('reload', () => {
    if (reloading) return
    reloading = true
    location.reload()
  })
  es.addEventListener('building', () => { document.documentElement.dataset.snzBuilding = '1' })
  es.addEventListener('error', () => { /* server restart, EventSource auto-reconnects */ })
})()
`

await runBuild()

const server = await startServer()

async function handleRequest(req: Request) {
    const url = new URL(req.url)
    let path = decodeURIComponent(url.pathname)
    if (path.endsWith('/')) path = path.slice(0, -1) || '/'

    // SSE event stream
    if (path === '/__snz/events') {
      const stream = new ReadableStream({
        start(controller) {
          sseClients.add(controller)
          controller.enqueue(`event: hello\ndata: {}\n\n`)
        },
        cancel(controller) { sseClients.delete(controller) },
      })
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // HMR client script
    if (path === '/__snz/hmr.js') {
      return new Response(HMR_CLIENT, { headers: { 'Content-Type': 'text/javascript' } })
    }

    // If the most recent build failed, serve the error banner for all HTML requests.
    const errorPage = Bun.file(join(dist, '__build-error.html'))
    const wantsHtml = !isAssetPath(path) || path.endsWith('.html') || path === '/'
    if (wantsHtml && (await errorPage.exists())) {
      return new Response(errorPage, { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }

    const filePath = path === '/' ? '/index.html' : path

    const candidates = filePath.endsWith('.html') ? [filePath] : [filePath, `${filePath}.html`]
    for (const p of candidates) {
      const f = Bun.file(join(dist, p))
      if (await f.exists()) {
        // Inject HMR client into HTML responses
        if (p.endsWith('.html')) {
          const text = await f.text()
          const withHmr = text.replace('</body>', '<script src="/__snz/hmr.js"></script></body>')
          return new Response(withHmr, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
        }
        return new Response(f)
      }
    }

    if (isAssetPath(path)) return new Response('Not found', { status: 404 })

    // SPA fallback to the shell. If the shell hasn't been built yet, show a friendly waiting page
    // (initial build still running, or a failure before __build-error.html was emitted).
    const shell = Bun.file(join(dist, 'index.html'))
    if (!(await shell.exists())) {
      return new Response(waitingPage(), {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '1' },
      })
    }
    const idx = await shell.text()
    const withHmr = idx.replace('</body>', '<script src="/__snz/hmr.js"></script></body>')
    return new Response(withHmr, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

async function startServer() {
  for (let port = preferredPort; port < preferredPort + 20; port++) {
    try {
      return Bun.serve({ port, fetch: handleRequest, idleTimeout: 255 })
    } catch (err) {
      const code = typeof err === 'object' && err && 'code' in err ? String(err.code) : ''
      const message = err instanceof Error ? err.message : String(err)
      if (code !== 'EADDRINUSE' && !message.includes('EADDRINUSE')) throw err
    }
  }
  throw new Error(`No available port found from ${preferredPort} to ${preferredPort + 19}`)
}

function waitingPage() {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="UTF-8"><title>Building…</title>
<style>
:root { color-scheme: dark; }
body { margin: 0; min-height: 100dvh; display: grid; place-items: center;
  font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  background: #0a0a0a; color: #fafafa; }
.box { text-align: center; opacity: .8; }
.dot { display: inline-block; width: .5em; height: .5em; border-radius: 50%; background: currentColor;
  margin-right: .5em; animation: pulse 1.2s ease-in-out infinite; vertical-align: middle; }
@keyframes pulse { 0%,100% { opacity: .25 } 50% { opacity: 1 } }
button { margin-top: 1.5rem; padding: .5rem 1rem; background: transparent;
  border: 1px solid currentColor; border-radius: .25rem; color: inherit; font: inherit; cursor: pointer; }
</style>
</head>
<body>
<div class="box">
  <div><span class="dot"></span>Waiting for first build…</div>
  <button onclick="location.reload()">Retry</button>
</div>
<script>
// Poll for index.html — once it appears, reload once. SSE 'reload' from rapid rebuilds
// is intentionally NOT subscribed here to avoid a reload loop when something else is wrong.
let done = false
async function poll() {
  if (done) return
  try {
    const r = await fetch('/', { method: 'HEAD', cache: 'no-store' })
    if (r.ok) { done = true; location.reload(); return }
  } catch {}
  setTimeout(poll, 750)
}
poll()
</script>
</body></html>`
}

console.log(`http://localhost:${server.port}`)

const watchers = new Map<string, ReturnType<typeof watch>>()

function watchTree(rootPath: string, recursive: boolean) {
  if (watchers.has(rootPath)) return
  try {
    const watcher = watch(rootPath, { recursive }, onWatch(rootPath))
    watchers.set(rootPath, watcher)
    const release = () => {
      if (watchers.get(rootPath) === watcher) watchers.delete(rootPath)
    }
    watcher.on('close', release)
    watcher.on('error', release)
  } catch {}
}

const managedWatchRoots = [
  ...['pages', 'routes', 'components', 'assets', 'templates', 'styles', 'app', 'data', 'images', 'videos', 'files']
    .map((rel) => join(src, rel)),
  ...['content', 'media'].map((rel) => join(root, rel)),
]
async function ensureManagedWatchTrees() {
  for (const path of managedWatchRoots) {
    const present = await fsStat(path).then((entry) => entry.isDirectory()).catch(() => false)
    const current = watchers.get(path)
    if (present && !current) watchTree(path, true)
    if (!present && current) {
      watchers.delete(path)
      current.close()
    }
  }
}

watchTree(src, false) // root files plus creation/removal of managed source subdirectories
watchTree(join(packageRoot, 'build'), true)
watchTree(join(packageRoot, 'runtime'), true)
watchTree(root, false) // .pages.yml, optional content/media roots, and legacy top-level runtime files
watchTree(join(root, 'runtime'), true)
watchTree(join(root, 'lib'), true)
await ensureManagedWatchTrees()
