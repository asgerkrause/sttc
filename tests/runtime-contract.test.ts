import { describe, expect, test } from 'bun:test'
import { readFile } from 'fs/promises'

describe('runtime ownership contracts', () => {
  test('router owns component lifecycle API', async () => {
    const router = await readFile('runtime/router.js', 'utf8')

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
    const router = await readFile('runtime/router.js', 'utf8')

    expect(router).toContain('function focusRouteRoot')
    expect(router).toContain("main.querySelector('h1, h2, [role=\"heading\"]') ?? main")
    expect(router).toContain('target.focus({ preventScroll: true })')
    expect(router).toContain('focusRouteRoot()')
    expect(router).toContain("render(location.pathname, { focus: true })")
  })

  test('router announces client route changes through shell live region', async () => {
    const router = await readFile('runtime/router.js', 'utf8')
    const shell = await readFile('src/shell.html', 'utf8')

    expect(shell).toContain('data-snz-announcer')
    expect(shell).toContain('aria-live="polite"')
    expect(shell).toContain('aria-atomic="true"')
    expect(router).toContain("document.querySelector('[data-snz-announcer]')")
    expect(router).toContain('function routeAnnouncementLabel')
    expect(router).toContain('announceRoute()')
  })
})
