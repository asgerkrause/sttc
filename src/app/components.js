// Component lifecycle runtime.
// Build registers mount fns per component name via snz._registerComponent('Name', fn).
// On each navigation (and on initial load), we walk new instances ([data-snz-component=N]:not([data-snz-mounted]))
// and invoke their mount fn with the root element. The fn may return a cleanup fn.
//
// Re-runs idempotently per element (data-snz-mounted attribute prevents double-mount).

const registry = new Map() // name -> Array<(el) => (()=>void)|void>
const cleanups = new WeakMap() // el -> Array<()=>void>

function mountAll() {
  for (const [name, fns] of registry) {
    const sel = `[data-snz-component="${name}"]:not([data-snz-mounted])`
    for (const el of document.querySelectorAll(sel)) {
      const teardowns = []
      for (const fn of fns) {
        try {
          const teardown = fn(el)
          if (typeof teardown === 'function') teardowns.push(teardown)
        } catch (e) {
          console.error(`[snz] ${name} mount error:`, e)
        }
      }
      if (teardowns.length) cleanups.set(el, teardowns)
      el.setAttribute('data-snz-mounted', '')
    }
  }
}

function unmountStale(root) {
  // Called before a page swap: any mounted element about to be replaced runs its cleanup.
  for (const el of root.querySelectorAll('[data-snz-mounted]')) {
    const teardowns = cleanups.get(el)
    if (!teardowns) continue
    for (const t of teardowns) {
      try { t() } catch (e) { console.error('[snz] cleanup error:', e) }
    }
    cleanups.delete(el)
  }
}

function ensureSnz() {
  if (!window.snz) window.snz = {}
  const snz = window.snz
  if (!snz._registerComponent) {
    snz._registerComponent = (name, fn) => {
      if (!registry.has(name)) registry.set(name, [])
      registry.get(name).push(fn)
    }
  }
  if (!snz._mountComponents) snz._mountComponents = mountAll
  if (!snz._unmountIn) snz._unmountIn = unmountStale
  return snz
}

const snz = ensureSnz()

// Run on snz:page (router fires this after DOM swap + scroll reset).
document.addEventListener('snz:page', mountAll)

// First load — DOMContentLoaded already-fired safe.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountAll)
} else {
  queueMicrotask(mountAll)
}

// Hook before-navigate to tear down current instances cleanly.
if (snz.beforeNavigate) {
  snz.beforeNavigate(() => {
    const main = document.querySelector('main[data-route-root]')
    if (main) unmountStale(main)
  })
}
