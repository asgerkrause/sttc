// Page runtime. Navigation is native: every link is a full document load with cross-document view
// transitions from project CSS and speculation rules from the shell. This file mounts
// components, reports the page, tracks events, and manages visibility, active media, and disclosures.
import { publicPath } from './lib/paths.js'

const main = document.querySelector('body > main')

const DISCLOSURE_SEL =
  'button[aria-controls][aria-expanded]:not([data-snz-ignore])'

const ACTIVE_MEDIA_SELECTOR = 'video[autoplay], audio[autoplay]'
const ACTIVE_MANUAL_SELECTOR = '[data-active="manual"]'
const DEFAULT_ACTIVE_THRESHOLD = 0
const DEFAULT_MEDIA_THRESHOLD = 0.2

const pageHandlers = new Map() // slug | '*' -> Set<fn>
const componentRegistry = new Map() // name -> Set<fn>
const componentCleanups = new WeakMap() // el -> Array<fn>
const visibilityObservers = new Map() // options key -> { observer, counts }
const visibilitySubscriptions = new Set()
const activeMediaCleanups = new WeakMap()
const activeMediaPaused = new WeakMap()
let currentPage = null // SnzPageDetail once the document is activated

function componentRoots(root, selector) {
  const out = []
  if (root instanceof Element && root.matches(selector)) out.push(root)
  for (const el of root.querySelectorAll(selector)) out.push(el)
  return out
}

function mountComponents(root = document) {
  for (const el of componentRoots(root, '[data-snz-component]')) {
    if (componentCleanups.has(el)) continue
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
    componentCleanups.set(el, teardowns)
  }
  mountActiveMedia(root)
}

function registerComponent(name, fn) {
  if (!componentRegistry.has(name)) componentRegistry.set(name, new Set())
  componentRegistry.get(name).add(fn)
  mountComponents()
  return () => componentRegistry.get(name)?.delete(fn)
}

function normalizeThreshold(value, fallback = DEFAULT_ACTIVE_THRESHOLD) {
  const number = Number.parseFloat(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(1, Math.max(0, number))
}

function visibilityKey(options) {
  return `${options.rootMargin}|${options.threshold}`
}

function isVisibleEntry(entry, threshold) {
  return entry.isIntersecting && entry.intersectionRatio >= threshold
}

function getVisibilityObserver(options) {
  const key = visibilityKey(options)
  const existing = visibilityObservers.get(key)
  if (existing) return existing

  const bucket = {
    counts: new Map(),
    observer: new IntersectionObserver((entries) => {
      for (const entry of entries) {
        for (const sub of visibilitySubscriptions) {
          if (sub.el !== entry.target || sub.key !== key) continue
          updateVisibilitySubscription(sub, isVisibleEntry(entry, sub.threshold), entry)
        }
      }
    }, { root: null, rootMargin: options.rootMargin, threshold: options.threshold }),
  }
  visibilityObservers.set(key, bucket)
  return bucket
}

function notifyVisibilitySubscription(sub, entry) {
  const state = sub.activeMode ? sub.active : sub.visible
  const previous = sub.lastState
  const detail = { visible: sub.visible, active: sub.active, entry, ratio: entry?.intersectionRatio ?? (sub.visible ? 1 : 0) }
  sub.change?.(detail)
  if (previous === state) return
  sub.lastState = state
  if (state) sub.enter?.(detail)
  else sub.exit?.(detail)
}

function updateVisibilitySubscription(sub, visible, entry) {
  sub.visible = visible
  sub.active = visible && !document.hidden
  notifyVisibilitySubscription(sub, entry)
}

function updateActiveSubscriptions() {
  for (const sub of visibilitySubscriptions) {
    if (!sub.activeMode) continue
    sub.active = sub.visible && !document.hidden
    notifyVisibilitySubscription(sub)
  }
}

function observeVisibility(el, handlers = {}, activeMode = false) {
  if (!(el instanceof Element)) return () => {}
  const threshold = normalizeThreshold(handlers.threshold)
  const rootMargin = typeof handlers.margin === 'string' ? handlers.margin : '0px'
  const key = visibilityKey({ rootMargin, threshold })
  const sub = { ...handlers, el, key, threshold, rootMargin, activeMode, visible: false, active: false, lastState: undefined }
  visibilitySubscriptions.add(sub)

  if (!('IntersectionObserver' in window)) {
    updateVisibilitySubscription(sub, true)
    return () => visibilitySubscriptions.delete(sub)
  }

  const bucket = getVisibilityObserver({ rootMargin, threshold })
  const count = bucket.counts.get(el) ?? 0
  bucket.counts.set(el, count + 1)
  if (count === 0) bucket.observer.observe(el)

  return () => {
    visibilitySubscriptions.delete(sub)
    const next = (bucket.counts.get(el) ?? 1) - 1
    if (next <= 0) {
      bucket.counts.delete(el)
      bucket.observer.unobserve(el)
    } else {
      bucket.counts.set(el, next)
    }
  }
}

function onVisible(el, handlers = {}) {
  return observeVisibility(el, handlers, false)
}

function onActive(el, handlers = {}) {
  return observeVisibility(el, handlers, true)
}

function isVisible(el, options = {}) {
  if (!(el instanceof Element)) return false
  const threshold = normalizeThreshold(options.threshold)
  const rect = el.getBoundingClientRect()
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight
  const visibleWidth = Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0)
  const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)
  if (visibleWidth <= 0 || visibleHeight <= 0 || rect.width <= 0 || rect.height <= 0) return false
  return (visibleWidth * visibleHeight) / (rect.width * rect.height) >= threshold
}

function isActive(el, options = {}) {
  return !document.hidden && isVisible(el, options)
}

function hasManualActive(el) {
  return Boolean(el.closest?.(ACTIVE_MANUAL_SELECTOR))
}

function playMedia(media) {
  const played = media.play()
  if (played && typeof played.catch === 'function') played.catch(() => {})
}

function mountActiveMedia(root = document) {
  for (const media of componentRoots(root, ACTIVE_MEDIA_SELECTOR)) {
    if (activeMediaCleanups.has(media) || hasManualActive(media)) continue
    const off = onActive(media, {
      threshold: DEFAULT_MEDIA_THRESHOLD,
      exit() {
        if (media.paused) return
        activeMediaPaused.set(media, true)
        media.pause()
      },
      enter() {
        if (!activeMediaPaused.get(media)) return
        activeMediaPaused.delete(media)
        playMedia(media)
      },
    })
    activeMediaCleanups.set(media, off)
  }
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

// Same-document anchor links do not unload the page, so an open nav must close itself.
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

function syncNavCurrent() {
  const current = publicPath(location.pathname)
  for (const a of document.querySelectorAll('nav a[href]')) {
    if (a.origin !== location.origin) continue
    if (publicPath(a.pathname) === current) a.setAttribute('aria-current', 'page')
    else a.removeAttribute('aria-current')
  }
}

function track(event, data = {}) {
  if (!event) return
  document.dispatchEvent(new CustomEvent('snz:track', { detail: { event, data: { ...data } } }))
}

function trackElement(el) {
  const event = el?.getAttribute?.('data-snz-track')
  if (!event) return
  const data = {}
  const location = el.getAttribute('data-snz-track-location')
  if (location) data.location = location
  track(event, data)
}

// ---- public API ----

function page() {
  return document.documentElement.dataset.snzRoute
}

function onPage(slug, fn) {
  const key = slug || '*'
  if (!pageHandlers.has(key)) pageHandlers.set(key, new Set())
  pageHandlers.get(key).add(fn)
  // Fire immediately if the document is already activated and matches.
  if (currentPage && (key === '*' || key === currentPage.slug)) {
    queueMicrotask(() => {
      try { fn(currentPage) } catch (e) { console.error(e) }
    })
  }
  return () => pageHandlers.get(key)?.delete(fn)
}

window.snz = {
  page,
  onPage,
  track,
  onVisible,
  isVisible,
  onActive,
  isActive,
  registerComponent,
  _registerComponent: registerComponent,
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
  if (a && a.origin === location.origin) closeDisclosuresForLink(a)
})

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return
  const open = document.querySelector(`${DISCLOSURE_SEL}[aria-expanded="true"]`)
  if (!open) return
  setDisclosure(open, false)
  open.focus()
})

document.addEventListener('visibilitychange', updateActiveSubscriptions)

function activatePage() {
  const slug = page() ?? ''
  const detail = { pathname: location.pathname, slug, main }
  mountComponents(main ?? document)
  syncNavCurrent()
  currentPage = detail
  for (const fn of pageHandlers.get('*') ?? []) {
    try { fn(detail) } catch (e) { console.error(e) }
  }
  for (const fn of pageHandlers.get(slug) ?? []) {
    try { fn(detail) } catch (e) { console.error(e) }
  }
  document.dispatchEvent(new CustomEvent('snz:page', { detail }))
}

if (document.readyState === 'complete') activatePage()
else window.addEventListener('DOMContentLoaded', activatePage, { once: true })
