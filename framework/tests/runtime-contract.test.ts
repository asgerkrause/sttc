import { describe, expect, test } from 'bun:test'
import { readFile } from 'fs/promises'

const SPECULATION_RULES =
  '<script type="speculationrules">{"prefetch":[{"source":"document","where":{"href_matches":"/*"},"eagerness":"moderate"}]}</script>'

describe('runtime ownership contracts', () => {
  test('starter TypeScript declarations match the runtime API', async () => {
    const rootTypes = await readFile('src/snz.d.ts', 'utf8')
    const starterTypes = await readFile('templates/default/src/snz.d.ts', 'utf8')
    const frameworkTypes = await readFile('framework/types/snz.d.ts', 'utf8')
    expect(starterTypes).toBe(rootTypes)
    expect(frameworkTypes).toBe(rootTypes)
    expect(rootTypes).toContain('pathname: string')
    expect(rootTypes).toContain('SnzComponentMount = (el: Element)')
    expect(rootTypes).toContain('snz: SnzRuntime')
    expect(rootTypes).not.toContain('snz?: SnzRuntime')
    expect(rootTypes).not.toContain('WindowEventMap')
    expect(rootTypes).not.toContain('window.va')
    expect(rootTypes).toContain("'snz:page': CustomEvent<SnzPageDetail>")
    expect(rootTypes).toContain("'snz:track': CustomEvent<{ event: string; data: Record<string, unknown> }>")
    for (const method of ['page', 'onPage', 'track', 'onVisible', 'isVisible', 'onActive', 'isActive', 'registerComponent', '_registerComponent']) {
      expect(rootTypes).toContain(`${method}(`)
    }
    for (const removed of ['navigate', 'prefetch', 'beforeNavigate', 'afterNavigate', '_reload', '_mountComponents', '_unmountIn']) {
      expect(rootTypes).not.toContain(`${removed}(`)
    }
  })

  test('Lenis bootstrap matches the starter and initializes per document', async () => {
    const rootScroll = await readFile('src/app/scroll.js', 'utf8')
    const starterScroll = await readFile('templates/default/src/app/scroll.js', 'utf8')
    const rootVendor = await readFile('src/app/vendor/lenis.min.js', 'utf8')
    const starterVendor = await readFile('templates/default/src/app/vendor/lenis.min.js', 'utf8')

    expect(starterScroll).toBe(rootScroll)
    expect(rootScroll).toContain('stopInertiaOnNavigate: true')
    expect(rootScroll).not.toContain('snz:scroll-reset')
    expect(starterVendor).toBe(rootVendor)
    expect(rootVendor).toContain('stopInertiaOnNavigate')
  })

  test('router is a page runtime with no client-side navigation', async () => {
    const router = await readFile('framework/runtime/router.js', 'utf8')

    for (const removed of [
      'fetch(', 'pushState', 'startViewTransition', 'mergeHead', 'announcer', 'focusRouteRoot',
      'routeCache', 'preload', 'popstate', 'scroll-reset',
      'navigate', 'prefetch', '_reload', '_mountComponents', '_unmountIn',
    ]) {
      expect(router).not.toContain(removed)
    }
  })

  test('router exposes the page runtime API', async () => {
    const router = await readFile('framework/runtime/router.js', 'utf8')
    const api = router.slice(router.indexOf('window.snz = {'), router.indexOf('}', router.indexOf('window.snz = {')))
    const keys = api.split('\n').slice(1).map((line) => line.trim().replace(/[:,].*$/, '')).filter(Boolean).sort()

    expect(keys).toEqual(['_registerComponent', 'isActive', 'isVisible', 'onActive', 'onPage', 'onVisible', 'page', 'registerComponent', 'track'])
    expect(router).toContain('return document.documentElement.dataset.snzRoute')
    expect(router).toContain("window.addEventListener('DOMContentLoaded', activatePage")
    expect(router).toContain("document.dispatchEvent(new CustomEvent('snz:page', { detail }))")
    expect(router).toContain('const detail = { pathname: location.pathname, slug, main }')
    expect(router).toContain('fn(currentPage)')
  })

  test('router owns component lifecycle API', async () => {
    const router = await readFile('framework/runtime/router.js', 'utf8')

    expect(router).toContain("const main = document.querySelector('body > main')")
    expect(router).toContain('function registerComponent')
    expect(router).toContain('  registerComponent,\n  _registerComponent: registerComponent,')
    expect(router).toContain('mountComponents(main ?? document)')
    expect(router).toContain("componentRoots(root, '[data-snz-component]')")
    expect(router).toContain('if (componentCleanups.has(el)) continue')
    expect(router).toContain('componentCleanups.set(el, teardowns)')
    expect(router).not.toContain('data-snz-mounted')
  })

  test('router owns viewport activity API and autoplay media guard', async () => {
    const router = await readFile('framework/runtime/router.js', 'utf8')

    expect(router).toContain('function onVisible')
    expect(router).toContain('function onActive')
    expect(router).toContain('function isVisible')
    expect(router).toContain('function isActive')
    expect(router).toContain('ACTIVE_MEDIA_SELECTOR')
    expect(router).toContain("[data-active=\"manual\"]")
    expect(router).toContain('video[autoplay], audio[autoplay]')
    expect(router).toContain('DEFAULT_MEDIA_THRESHOLD = 0.2')
    expect(router).toContain("document.addEventListener('visibilitychange', updateActiveSubscriptions)")
  })

  test('router tracks through snz:track only', async () => {
    const router = await readFile('framework/runtime/router.js', 'utf8')

    expect(router).not.toContain('window.va')
    expect(router).toContain("document.dispatchEvent(new CustomEvent('snz:track', { detail: { event, data: { ...data } } }))")
    expect(router).toContain("e.target.closest('[data-snz-track]')")
  })

  test('shells prefetch documents with speculation rules and ship no live region', async () => {
    const rootShell = await readFile('src/shell.html', 'utf8')
    const starterShell = await readFile('templates/default/src/shell.html', 'utf8')

    for (const shell of [rootShell, starterShell]) {
      expect(shell).toContain(SPECULATION_RULES)
      expect(shell).not.toContain('data-snz-announcer')
      expect(shell).not.toContain('/assets/js/components.js')
    }
    expect(await Bun.file('src/app/components.js').exists()).toBe(false)
  })

  test('project CSS drives cross-document view transitions', async () => {
    const rootMotion = await readFile('src/styles/layers/motion.css', 'utf8')
    const starterMotion = await readFile('templates/default/src/styles/layers/motion.css', 'utf8')
    const rootLayout = await readFile('src/styles/layers/layout.css', 'utf8')
    const starterLayout = await readFile('templates/default/src/styles/layers/layout.css', 'utf8')

    for (const css of [rootMotion, starterMotion]) {
      expect(css).toContain('@view-transition')
      expect(css).toContain('navigation: auto')
      expect(css).toContain('::view-transition-old(main)')
      expect(css).toContain('::view-transition-new(main)')
      expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    }
    for (const css of [rootLayout, starterLayout]) {
      expect(css).toContain('view-transition-name: main')
    }
  })
})

describe('dev server runtime contracts', () => {
  test('HMR performs a correct full reload for shell, CSS, route, and app changes', async () => {
    const dev = await readFile('framework/dev.ts', 'utf8')

    expect(dev).toContain('location.reload()')
    expect(dev).toContain('let reloading = false')
    expect(dev).not.toContain('window.snz?._reload')
    expect(dev).not.toContain('Hot-swap hashed components.css')
  })

  test('dev watcher includes canonical runtime and public media directories', async () => {
    const dev = await readFile('framework/dev.ts', 'utf8')

    expect(dev).toContain("watchTree(join(packageRoot, 'runtime'), true)")
    expect(dev).toContain('watchTree(src, false)')
    expect(dev).toContain('const managedWatchRoots = [')
    expect(dev).toContain("'images', 'videos', 'files'")
    expect(dev).toContain("...['content', 'media']")
    expect(dev).not.toContain('/\\.webp$/i.test(base)')
    expect(dev).toContain("base === 'dist' || base.startsWith('dist.__')")
    expect(dev).toContain('legacy top-level runtime files')
  })
})
