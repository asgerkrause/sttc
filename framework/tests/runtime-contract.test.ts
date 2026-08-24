import { describe, expect, test } from 'bun:test'
import { readFile } from 'fs/promises'

describe('runtime ownership contracts', () => {
  test('starter TypeScript declarations match the runtime API', async () => {
    const rootTypes = await readFile('src/snz.d.ts', 'utf8')
    const starterTypes = await readFile('templates/default/src/snz.d.ts', 'utf8')
    const frameworkTypes = await readFile('framework/types/snz.d.ts', 'utf8')
    expect(starterTypes).toBe(rootTypes)
    expect(frameworkTypes).toBe(rootTypes)
    expect(rootTypes).toContain('pathname: string')
    expect(rootTypes).toContain('navigate(path: string, options?: { replace?: boolean }): Promise<void>')
    expect(rootTypes).toContain('prefetch(path: string): Promise<string | null>')
    expect(rootTypes).toContain('SnzComponentMount = (el: Element)')
    for (const method of ['onVisible', 'isVisible', 'onActive', 'isActive']) {
      expect(rootTypes).toContain(`${method}(`)
    }
  })

  test('Lenis stops inertia before internal route navigation', async () => {
    const rootScroll = await readFile('src/app/scroll.js', 'utf8')
    const starterScroll = await readFile('templates/default/src/app/scroll.js', 'utf8')
    const rootVendor = await readFile('src/app/vendor/lenis.min.js', 'utf8')
    const starterVendor = await readFile('templates/default/src/app/vendor/lenis.min.js', 'utf8')

    expect(starterScroll).toBe(rootScroll)
    expect(rootScroll).toContain('stopInertiaOnNavigate: true')
    expect(starterVendor).toBe(rootVendor)
    expect(rootVendor).toContain('stopInertiaOnNavigate')
  })

  test('router owns component lifecycle API', async () => {
    const router = await readFile('framework/runtime/router.js', 'utf8')

    expect(router).toContain("const main = document.querySelector('body > main')")
    expect(router).not.toContain('main[data-route-root]')
    expect(router).toContain('function registerComponent')
    expect(router).toContain('_registerComponent: registerComponent')
    expect(router).toContain('mountComponents(main)')
    expect(router).toContain('unmountComponents(main)')
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
    expect(router).toContain('updateActiveSubscriptions()')
  })

  test('shells do not depend on site-owned component lifecycle helper', async () => {
    const rootShell = await readFile('src/shell.html', 'utf8')
    const starterShell = await readFile('templates/default/src/shell.html', 'utf8')

    expect(rootShell).not.toContain('/assets/js/components.js')
    expect(starterShell).not.toContain('/assets/js/components.js')
    expect(await Bun.file('src/app/components.js').exists()).toBe(false)
  })

  test('router owns route-change focus management', async () => {
    const router = await readFile('framework/runtime/router.js', 'utf8')

    expect(router).toContain('function focusRouteRoot')
    expect(router).toContain("main.querySelector('h1, h2, [role=\"heading\"]') ?? main")
    expect(router).toContain('target.focus({ preventScroll: true, focusVisible: false })')
    expect(router).toContain('if (focus) {\n    focusRouteRoot()')
    expect(router).not.toContain('pointerInput')
    expect(router).toContain("render(location.pathname, { focus: true })")
  })

  test('router announces client route changes through shell live region', async () => {
    const router = await readFile('framework/runtime/router.js', 'utf8')
    const rootShell = await readFile('src/shell.html', 'utf8')
    const starterShell = await readFile('templates/default/src/shell.html', 'utf8')

    for (const shell of [rootShell, starterShell]) {
      expect(shell).toContain('<Footer />\n  <div data-snz-announcer aria-live="polite" aria-atomic="true"></div>')
      expect(shell).not.toContain('data-snz-announcer aria-live="polite" aria-atomic="true" style=')
    }
    expect(router).toContain("document.querySelector('[data-snz-announcer]')")
    expect(router).toContain('routeAnnouncer.hidden = true')
    expect(router).toContain('Object.assign(routeAnnouncer.style')
    expect(router).toContain("clipPath: 'inset(50%)'")
    expect(router).toContain('function routeAnnouncementLabel')
    expect(router).toContain('announceRoute()')
  })

  test('router clears stale route head state even when next route has empty head', async () => {
    const router = await readFile('framework/runtime/router.js', 'utf8')

    expect(router).toContain('mergeHead(head)')
    expect(router).not.toContain('if (head?.children.length) mergeHead(head)')
  })

  test('router preserves URL search and hash while fetching route pathname', async () => {
    const router = await readFile('framework/runtime/router.js', 'utf8')

    expect(router).toContain('function routeTarget')
    expect(router).toContain('new URL(path, location.href)')
    expect(router).toContain("history.pushState(null, '', href)")
    expect(router).toContain('await render(pathname, { focus: true })')
    expect(router).toContain('go(`${a.pathname}${a.search}${a.hash}`)')
  })

  test('router uses View Transitions only when project CSS names the route root', async () => {
    const router = await readFile('framework/runtime/router.js', 'utf8')
    const rootMotion = await readFile('src/styles/layers/motion.css', 'utf8')
    const starterMotion = await readFile('templates/default/src/styles/layers/motion.css', 'utf8')
    const rootLayout = await readFile('src/styles/layers/layout.css', 'utf8')
    const starterLayout = await readFile('templates/default/src/styles/layers/layout.css', 'utf8')

    expect(router).toContain('function hasCssViewTransition()')
    expect(router).toContain("name && name !== 'none'")
    expect(router).toContain('if (transition && hasCssViewTransition())')
    expect(router).not.toContain('if (transition && document.startViewTransition)')
    for (const css of [rootMotion, starterMotion]) {
      expect(css).toContain('@view-transition')
      expect(css).toContain('::view-transition-old(main)')
      expect(css).toContain('::view-transition-new(main)')
      expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    }
    for (const css of [rootLayout, starterLayout]) {
      expect(css).toContain('view-transition-name: main')
    }
  })

  test('router aborts stale route fetches and guards stale DOM applies', async () => {
    const router = await readFile('framework/runtime/router.js', 'utf8')

    expect(router).toContain('let navigationId = 0')
    expect(router).toContain('navigationController?.abort()')
    expect(router).toContain('new AbortController()')
    expect(router).toContain('fetchRouteHtml(pathname, { signal: navigation.signal })')
    expect(router).toContain('if (!isActiveNavigation(navigation)) return')
    expect(router).toContain("return render('/404/', { is404: true, transition, focus, navigation })")
  })

  test('router exposes no-history reload path for dev HMR', async () => {
    const router = await readFile('framework/runtime/router.js', 'utf8')

    expect(router).toContain('function reloadCurrentRoute')
    expect(router).toContain('routeCache.delete(fetchPath(location.pathname))')
    expect(router).toContain('render(publicPath(location.pathname), { transition: false })')
    expect(router).toContain('_reload: reloadCurrentRoute')
    expect(router).toContain('navigate: (path, options) => go(path, options)')
    expect(router).toContain("if (replace) history.replaceState(null, '', href)")
  })

  test('uses matching static markup, preserves shell fallback routing, and reuses pending preloads', async () => {
    const router = await readFile('framework/runtime/router.js', 'utf8')

    expect(router).toContain('function activateInitialRoute')
    expect(router).toContain('document.documentElement.dataset.snzRoute')
    expect(router).toContain('if (renderedRoute === slugFromPath(initial))')
    expect(router).toContain("window.addEventListener('DOMContentLoaded', activateInitialRoute")
    expect(router).toContain('render(initial, { transition: false })')
    expect(router.indexOf('if (routePending.has(url))')).toBeLessThan(router.indexOf('if (signal)'))
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
