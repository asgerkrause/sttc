import { describe, expect, test } from 'bun:test'
import { readFile } from 'fs/promises'

describe('runtime ownership contracts', () => {
  test('router owns component lifecycle API', async () => {
    const router = await readFile('framework/runtime/router.js', 'utf8')

    expect(router).toContain('function registerComponent')
    expect(router).toContain('_registerComponent: registerComponent')
    expect(router).toContain('mountComponents(main)')
    expect(router).toContain('unmountComponents(main)')
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
    expect(router).toContain('target.focus({ preventScroll: true })')
    expect(router).toContain('focusRouteRoot()')
    expect(router).toContain("render(location.pathname, { focus: true })")
  })

  test('router announces client route changes through shell live region', async () => {
    const router = await readFile('framework/runtime/router.js', 'utf8')
    const rootShell = await readFile('src/shell.html', 'utf8')
    const starterShell = await readFile('templates/default/src/shell.html', 'utf8')
    const rootStyles = await readFile('src/styles/wrappers.css', 'utf8')
    const starterStyles = await readFile('templates/default/src/styles/wrappers.css', 'utf8')

    for (const shell of [rootShell, starterShell]) {
      expect(shell).toContain('<Footer />\n  <div data-snz-announcer aria-live="polite" aria-atomic="true"></div>')
      expect(shell).not.toContain('data-snz-announcer aria-live="polite" aria-atomic="true" style=')
    }
    for (const styles of [rootStyles, starterStyles]) {
      expect(styles).toContain('[data-snz-announcer]')
      expect(styles).toContain('clip-path: inset(50%)')
    }
    expect(router).toContain("document.querySelector('[data-snz-announcer]')")
    expect(router).toContain('routeAnnouncer.hidden = true')
    expect(router).not.toContain('routeAnnouncer.style.cssText')
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
    expect(router).toContain('render(publicPath(location.pathname), { transition: false })')
    expect(router).toContain('_reload: reloadCurrentRoute')
    expect(router).toContain('navigate: (path, options) => go(path, options)')
    expect(router).toContain("if (replace) history.replaceState(null, '', href)")
  })
})

describe('dev server runtime contracts', () => {
  test('HMR reloads through router without pushing history and clears building state', async () => {
    const dev = await readFile('framework/dev.ts', 'utf8')

    expect(dev).toContain('window.snz?._reload')
    expect(dev).toContain("window.snz.navigate(location.pathname, { replace: true })")
    expect(dev).toContain('delete document.documentElement.dataset.snzBuilding')
  })

  test('dev watcher includes canonical runtime directory', async () => {
    const dev = await readFile('framework/dev.ts', 'utf8')

    expect(dev).toContain("watchTree(join(packageRoot, 'runtime'), true)")
    expect(dev).toContain('legacy top-level runtime files')
  })
})
