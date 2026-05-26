import { watch } from 'fs'
import { stat as fsStat } from 'fs/promises'
import { basename, join } from 'path'
import { spawn } from 'bun'
import { isAssetPath } from './lib/paths.js'

const root = import.meta.dir
const src = join(root, 'src')
const dist = join(root, 'dist')
const port = 3000

let building = false
let dirty = false           // event arrived while we were building or absorbing — needs a build after the window
let buildCooldownUntil = 0
// macOS FSEvents fires many "change" events per single save (atime touches when files are read
// during the build, plus duplicate events from the kernel). After each build, drop events for
// ECHO_ABSORB_MS — they're almost always stale echoes of the change that just rebuilt.
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
  const proc = spawn(['bun', 'build/index.ts'], {
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
  // If a genuine change came in during the build, schedule one rebuild AFTER the absorb window —
  // not immediately, so echoes from this build's own writes don't pile in.
  if (dirty) {
    dirty = false
    setTimeout(() => { runBuild() }, ECHO_ABSORB_MS)
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined

function scheduleBuild() {
  if (building) {
    dirty = true
    return
  }
  // During the post-build echo-absorb window, silently drop events — they're almost certainly
  // stale FSEvents notifications for files we just touched.
  if (Date.now() < buildCooldownUntil) return
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => runBuild(), DEBOUNCE_MS)
}

function shouldIgnoreWatch(filename: string | null) {
  if (!filename) return false
  const base = basename(filename)
  if (base === '.DS_Store' || base === '.gitkeep' || base.startsWith('.')) return true
  if (/\.webp$/i.test(base)) return true
  if (base === '__build-error.html') return true
  return false
}

// macOS FSEvents reports atime-only changes (when the build reads source files) as
// "change" events. Track content-relevant stats per filename and ignore events where
// mtime + size are unchanged — those are pure access-time noise.
const stamps = new Map<string, string>()

async function stamp(absPath: string): Promise<string | null> {
  try {
    const s = await fsStat(absPath)
    if (!s.isFile()) return null
    return `${s.mtimeMs}:${s.size}`
  } catch { return null }
}

async function looksLikeRealChange(absPath: string): Promise<boolean> {
  const next = await stamp(absPath)
  if (next === null) {
    // File was deleted — that IS a real change. Drop stamp so re-create re-triggers.
    if (stamps.delete(absPath)) return true
    return false
  }
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
    scheduleBuild()
  }
}

const HMR_CLIENT = `
// snz HMR client — injected only in dev. Throttles aggressively to avoid reload pile-on.
(() => {
  if (window.__snzHmr) return; window.__snzHmr = true
  let pending = false
  let lastApplied = 0
  const COOLDOWN_MS = 2500

  async function applyReload() {
    if (pending) return
    pending = true
    try {
      const elapsed = Date.now() - lastApplied
      if (elapsed < COOLDOWN_MS) {
        await new Promise(r => setTimeout(r, COOLDOWN_MS - elapsed))
      }
      const html = await (await fetch('/', { cache: 'no-store' })).text()
      // Hot-swap hashed components.css if it changed.
      const m = html.match(/href="(\\/assets\\/css\\/components\\.[a-f0-9]+\\.css)"/)
      if (m) {
        const cur = document.querySelector('link[rel="stylesheet"][href*="/assets/css/components"]')
        if (cur && cur.getAttribute('href') !== m[1]) {
          const next = cur.cloneNode()
          next.href = m[1]
          next.onload = () => cur.remove()
          cur.parentNode.insertBefore(next, cur.nextSibling)
        }
      }
      // Re-render current route via snz router if possible.
      if (window.snz?.navigate) await window.snz.navigate(location.pathname)
      else location.reload()
      lastApplied = Date.now()
    } catch {
      location.reload()
    } finally {
      pending = false
    }
  }

  const es = new EventSource('/__snz/events')
  es.addEventListener('reload', () => applyReload())
  es.addEventListener('building', () => { document.documentElement.dataset.snzBuilding = '1' })
  es.addEventListener('error', () => { /* server restart, EventSource auto-reconnects */ })
})()
`

await runBuild()

Bun.serve({
  port,
  async fetch(req) {
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
  },
})

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

console.log(`http://localhost:${port}`)

function watchTree(rootPath: string, recursive: boolean) {
  try { watch(rootPath, { recursive }, onWatch(rootPath)) } catch {}
}

for (const rel of ['routes', 'components', 'assets', 'templates']) {
  watchTree(join(src, rel), true)
}
watchTree(src, false) // shell.html, site.json — watch dir, not file (file watches die on save+rename)
watchTree(join(root, 'build'), true)
watchTree(root, false) // router.js, .pages.yml
watchTree(join(root, 'lib'), true)
for (const rel of ['content', 'media']) {
  watchTree(join(root, rel), true)
}
