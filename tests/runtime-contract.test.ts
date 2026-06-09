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
})
