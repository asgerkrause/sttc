import { slugFromPath, publicPath, fetchPath } from './lib/paths.js'

const main = document.querySelector('main[data-route-root]')
let routeAnnouncer = null

const DISCLOSURE_SEL =
  'button[aria-controls][aria-expanded]:not([data-snz-ignore])'

const PRELOAD_DELAY_MS = 100
const ROUTE_CACHE_TTL_MS = 5 * 60 * 1000
const BACKGROUND_INVALIDATE_AFTER_MS = 10 * 60 * 1000

const routeCache = new Map() // url -> { html, at }
const routePending = new Map()
const preloadTimers = new WeakMap()
const pageHandlers = new Map() // slug | '*' -> Set<fn>
const beforeHandlers = new Set()
const afterHandlers = new Set()
const componentRegistry = new Map() // name -> Set<fn>
const componentCleanups = new WeakMap() // el -> Array<fn>
let navigationId = 0
let navigationController = null

function componentRoots(root, selector) {
  const out = []
  if (root instanceof Element && root.matches(selector)) out.push(root)
  for (const el of root.querySelectorAll(selector)) out.push(el)
  return out
}

function mountComponents(root = document) {
  for (const el of componentRoots(root, '[data-snz-component]:not([data-snz-mounted])')) {
    const name = el.getAttribute('data-snz-component')
    const fns = name ? componentRegistry.get(name) : null
    if (!name || !fns) continue

    const teardowns = []
    for (const fn of fns) {
      try {
        const teardown = fn(el)
        if (typeof teardown === 'function') teardowns.push(teardown)
      } catch (e) {
        console.error(`[snz] ${name} mount error:`, e)
      }
    }
    if (teardowns.length) componentCleanups.set(el, teardowns)
    el.setAttribute('data-snz-mounted', '')
  }
}

function unmountComponents(root) {
  for (const el of componentRoots(root, '[data-snz-mounted]')) {
    const teardowns = componentCleanups.get(el)
    if (!teardowns) continue
    for (const teardown of teardowns) {
      try { teardown() } catch (e) { console.error('[snz] cleanup error:', e) }
    }
    componentCleanups.delete(el)
  }
}

function registerComponent(name, fn) {
  if (!componentRegistry.has(name)) componentRegistry.set(name, new Set())
  componentRegistry.get(name).add(fn)
  mountComponents()
  return () => componentRegistry.get(name)?.delete(fn)
}

function wrapPage(raw) {
  const trimmed = raw.trim()
  if (/<html[\s>]/i.test(trimmed)) return null
  const hasHead = /^<head[\s>]/i.test(trimmed)
  const doc = new DOMParser().parseFromString(
    hasHead
      ? `<!doctype html><html>${trimmed}</html>`
      : `<!doctype html><html><body>${trimmed}</body></html>`,
    'text/html',
  )
  return { head: doc.querySelector('head'), body: doc.body }
}

function mergeHead(pageHead) {
  document.head.querySelectorAll('[data-snz-head]').forEach((n) => n.remove())
  const title = pageHead.querySelector('title')
  if (title?.textContent) document.title = title.textContent
  for (const el of pageHead.querySelectorAll('meta, link, script[type="application/ld+json"]')) {
    const clone = el.cloneNode(true)
    clone.setAttribute('data-snz-head', '')
    document.head.append(clone)
  }
  const transitionMeta = pageHead.querySelector('meta[name="snz:transition"]')
  if (transitionMeta) {
    document.documentElement.dataset.transition = transitionMeta.getAttribute('content') ?? ''
  } else {
    delete document.documentElement.dataset.transition
  }
}

function saveDataPreferred() {
  return navigator.connection?.saveData === true
}

function shouldPreloadLink(a) {
  if (a.origin !== location.origin) return false
  if (a.getAttribute('data-snz-preload') === 'off') return false
  if (a.hasAttribute('download')) return false
  if (a.target && a.target !== '_self') return false
  if (publicPath(a.pathname) === publicPath(location.pathname)) return false
  if (saveDataPreferred()) return false
  return true
}

async function fetchRouteHtml(pathname, { signal } = {}) {
  const url = fetchPath(pathname)
  const cached = routeCache.get(url)
  if (cached && Date.now() - cached.at < ROUTE_CACHE_TTL_MS) return cached.html
  if (signal?.aborted) return null

  if (signal) {
    return fetch(url, { signal })
      .then(async (res) => {
        if (!res.ok) return null
        const text = await res.text()
        routeCache.set(url, { html: text, at: Date.now() })
        return text
      })
      .catch(() => null)
  }

  if (routePending.has(url)) return routePending.get(url)

  const pending = fetch(url)
    .then(async (res) => {
      routePending.delete(url)
      if (!res.ok) return null
      const text = await res.text()
      routeCache.set(url, { html: text, at: Date.now() })
      return text
    })
    .catch(() => {
      routePending.delete(url)
      return null
    })

  routePending.set(url, pending)
  return pending
}

function preloadRoute(a) {
  if (!shouldPreloadLink(a)) return
  const url = fetchPath(a.pathname)
  const cached = routeCache.get(url)
  if ((cached && Date.now() - cached.at < ROUTE_CACHE_TTL_MS) || routePending.has(url)) return
  void fetchRouteHtml(a.pathname)
}

function schedulePreload(a) {
  if (!shouldPreloadLink(a)) return
  clearPreloadTimer(a)
  const id = setTimeout(() => {
    preloadTimers.delete(a)
    preloadRoute(a)
  }, PRELOAD_DELAY_MS)
  preloadTimers.set(a, id)
}

function clearPreloadTimer(a) {
  const id = preloadTimers.get(a)
  if (id !== undefined) clearTimeout(id)
  preloadTimers.delete(a)
}

function setDisclosure(control, open) {
  control.setAttribute('aria-expanded', open ? 'true' : 'false')
}

function toggleDisclosure(control) {
  const open = control.getAttribute('aria-expanded') !== 'true'
  setDisclosure(control, open)
}

function closeNavDisclosure(navId) {
  if (!navId) return
  for (const control of document.querySelectorAll(
    `${DISCLOSURE_SEL}[aria-controls="${CSS.escape(navId)}"]`,
  )) {
    setDisclosure(control, false)
  }
}

function closeDisclosuresForLink(link) {
  const nav = link.closest('nav[id]')
  if (nav?.id) {
    closeNavDisclosure(nav.id)
    return
  }
  const header = link.closest('header')
  if (!header) return
  for (const control of header.querySelectorAll(
    `${DISCLOSURE_SEL}[aria-expanded="true"]`,
  )) {
    setDisclosure(control, false)
  }
}

function syncNavCurrent(pathname = location.pathname) {
  const current = publicPath(pathname)
  for (const a of document.querySelectorAll('nav a[href]')) {
    if (a.origin !== location.origin) continue
    if (publicPath(a.pathname) === current) a.setAttribute('aria-current', 'page')
    else a.removeAttribute('aria-current')
  }
}

function emit(slug, detail) {
  for (const fn of pageHandlers.get('*') ?? []) {
    try { fn(detail) } catch (e) { console.error(e) }
  }
  for (const fn of pageHandlers.get(slug) ?? []) {
    try { fn(detail) } catch (e) { console.error(e) }
  }
  document.dispatchEvent(new CustomEvent('snz:page', { detail }))
}

function afterEmit(detail) {
  for (const fn of afterHandlers) {
    try { fn(detail) } catch (e) { console.error(e) }
  }
}

function track(event, data = {}) {
  if (!event) return
  const payload = { ...data }
  try {
    if (typeof window.va === 'function') {
      window.va('event', { name: event, data: payload })
      return
    }
    if (typeof window.va?.track === 'function') {
      window.va.track(event, payload)
      return
    }
    document.dispatchEvent(new CustomEvent('snz:track', { detail: { event, data: payload } }))
  } catch (e) {
    console.error('[snz] track error:', e)
  }
}

function trackElement(el) {
  const event = el?.getAttribute?.('data-snz-track')
  if (!event) return
  const data = {}
  const location = el.getAttribute('data-snz-track-location')
  if (location) data.location = location
  track(event, data)
}

function announcer() {
  if (routeAnnouncer) return routeAnnouncer
  routeAnnouncer = document.querySelector('[data-snz-announcer]') ?? document.createElement('div')
  routeAnnouncer.setAttribute('aria-live', 'polite')
  routeAnnouncer.setAttribute('aria-atomic', 'true')
  routeAnnouncer.dataset.snzAnnouncer = ''
  if (!routeAnnouncer.parentNode) {
    routeAnnouncer.hidden = true
    document.body.append(routeAnnouncer)
  }
  return routeAnnouncer
}

function focusRouteRoot() {
  if (!main) return
  const target = main.querySelector('h1, h2, [role="heading"]') ?? main
  if (!(target instanceof HTMLElement)) return
  const hadTabindex = target.hasAttribute('tabindex')
  if (!hadTabindex) target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
  if (!hadTabindex) {
    target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true })
  }
}

function routeAnnouncementLabel() {
  return main?.querySelector('h1, h2, [role="heading"]')?.textContent?.trim()
    || document.title
    || 'Page loaded'
}

function announceRoute() {
  announcer().textContent = routeAnnouncementLabel()
}

async function runBeforeNavigate(detail) {
  for (const fn of beforeHandlers) {
    try {
      const result = await fn(detail)
      if (result === false) return false
    } catch (e) { console.error(e) }
  }
  return true
}

function beginNavigation() {
  navigationController?.abort()
  navigationController = new AbortController()
  return { id: ++navigationId, signal: navigationController.signal }
}

function isActiveNavigation(navigation) {
  return navigation.id === navigationId && !navigation.signal.aborted
}

async function render(pathname, { is404 = false, transition = true, focus = false, navigation = beginNavigation() } = {}) {
  if (!main) return

  const raw = await fetchRouteHtml(pathname, { signal: navigation.signal })
  if (!isActiveNavigation(navigation)) return
  if (raw === null) {
    if (!is404 && slugFromPath(pathname) !== '404') {
      return render('/404/', { is404: true, transition, focus, navigation })
    }
    unmountComponents(main)
    main.replaceChildren()
    document.documentElement.removeAttribute('data-page')
    return
  }

  const parsed = wrapPage(raw)
  if (!isActiveNavigation(navigation)) return
  if (!parsed) {
    if (!is404 && slugFromPath(pathname) !== '404') {
      return render('/404/', { is404: true, transition, focus, navigation })
    }
    unmountComponents(main)
    main.replaceChildren()
    document.documentElement.removeAttribute('data-page')
    return
  }

  const { head, body } = parsed
  const slug = slugFromPath(pathname)
  const detail = { pathname, slug, main }

  const apply = () => {
    if (!isActiveNavigation(navigation)) return
    mergeHead(head)
    document.documentElement.dataset.page = slug
    unmountComponents(main)
    main.replaceChildren(...body.childNodes)
    mountComponents(main)
    resetScroll()
    syncNavCurrent(pathname)
    emit(slug, detail)
  }
  if (transition && document.startViewTransition) {
    await document.startViewTransition(apply).finished
  } else {
    apply()
  }
  if (!isActiveNavigation(navigation)) return
  if (focus) {
    focusRouteRoot()
    announceRoute()
  }
  afterEmit(detail)
}

function resetScroll() {
  if (window.lenis?.scrollTo) {
    window.lenis.scrollTo(0, { immediate: true, force: true })
  } else {
    window.scrollTo(0, 0)
  }
}

function routeTarget(path) {
  const url = new URL(path, location.href)
  const pathname = publicPath(url.pathname)
  return {
    pathname,
    href: `${pathname}${url.search}${url.hash}`,
  }
}

async function go(path, { replace = false } = {}) {
  const { pathname, href } = routeTarget(path)
  const detail = { pathname, slug: slugFromPath(pathname) }
  const ok = await runBeforeNavigate(detail)
  if (!ok) return
  if (replace) history.replaceState(null, '', href)
  else history.pushState(null, '', href)
  await render(pathname, { focus: true })
}

function reloadCurrentRoute() {
  return render(publicPath(location.pathname), { transition: false })
}

// ---- public API ----

function onPage(slug, fn) {
  const key = slug || '*'
  if (!pageHandlers.has(key)) pageHandlers.set(key, new Set())
  pageHandlers.get(key).add(fn)
  // Fire immediately if we're already on the matching page.
  const current = document.documentElement.dataset.page
  if (current && (key === '*' || key === current)) {
    queueMicrotask(() => {
      try { fn({ pathname: location.pathname, slug: current, main }) } catch (e) { console.error(e) }
    })
  }
  return () => pageHandlers.get(key)?.delete(fn)
}

window.snz = {
  navigate: (path, options) => go(path, options),
  page: () => document.documentElement.dataset.page,
  onPage,
  prefetch: (path) => fetchRouteHtml(path),
  beforeNavigate: (fn) => (beforeHandlers.add(fn), () => beforeHandlers.delete(fn)),
  afterNavigate: (fn) => (afterHandlers.add(fn), () => afterHandlers.delete(fn)),
  track,
  _reload: reloadCurrentRoute,
  _registerComponent: registerComponent,
  _mountComponents: mountComponents,
  _unmountIn: unmountComponents,
}

// ---- event wiring ----

document.addEventListener('click', (e) => {
  const control = e.target.closest(DISCLOSURE_SEL)
  if (control) {
    e.preventDefault()
    trackElement(control)
    toggleDisclosure(control)
    return
  }

  const tracked = e.target.closest('[data-snz-track]')
  if (tracked) trackElement(tracked)

  const a = e.target.closest('a[href]')
  if (!a || a.origin !== location.origin) return
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  if (a.target && a.target !== '' && a.target !== '_self') return
  if (a.hasAttribute('download')) return
  if (a.pathname === location.pathname && a.hash) return
  closeDisclosuresForLink(a)
  e.preventDefault()
  go(`${a.pathname}${a.search}${a.hash}`)
})

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return
  const open = document.querySelector(`${DISCLOSURE_SEL}[aria-expanded="true"]`)
  if (!open) return
  setDisclosure(open, false)
  open.focus()
})

function onPreloadIntent(e) {
  const a = e.target.closest('a[href]')
  if (!a) return
  schedulePreload(a)
}

function onPreloadCancel(e) {
  const a = e.target.closest('a[href]')
  if (!a) return
  const related = e.relatedTarget
  if (related instanceof Node && a.contains(related)) return
  clearPreloadTimer(a)
}

for (const type of ['mouseover', 'focusin']) {
  document.addEventListener(type, onPreloadIntent, { passive: true })
}
for (const type of ['mouseout', 'focusout']) {
  document.addEventListener(type, onPreloadCancel, { passive: true })
}
document.addEventListener(
  'touchstart',
  (e) => {
    const a = e.target.closest('a[href]')
    if (!a) return
    preloadRoute(a)
  },
  { passive: true },
)

window.addEventListener('popstate', () => render(location.pathname, { focus: true }))

// Invalidate route cache after long background
let hiddenAt = 0
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now()
  } else if (hiddenAt && Date.now() - hiddenAt > BACKGROUND_INVALIDATE_AFTER_MS) {
    routeCache.clear()
    hiddenAt = 0
  }
})

syncNavCurrent()

const initial = publicPath(location.pathname)
if (initial !== location.pathname) history.replaceState(null, '', initial)
render(initial, { transition: false })
