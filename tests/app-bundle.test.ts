import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { componentScriptBlocks, writeAppJs, type ScriptBlock } from '../build/extract-js'

const tempDirs: string[] = []

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) await rm(dir, { recursive: true, force: true })
  delete process.env.PUBLIC_TEST_VALUE
  delete process.env.SECRET_TEST_VALUE
})

async function makeTempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'snz-app-bundle-'))
  tempDirs.push(dir)
  return dir
}

describe('app bundle writer', () => {
  test('bundles TypeScript app entry imports and appends generated route scripts', async () => {
    const root = await makeTempDir()
    const src = join(root, 'src')
    const dist = join(root, 'dist', 'assets', 'js')
    await mkdir(src, { recursive: true })
    await writeFile(join(src, 'helper.ts'), 'export const value: string = "bundled"\n')
    await writeFile(join(src, 'app.ts'), 'import { value } from "./helper"\nwindow.__appValue = value\n')

    const blocks: ScriptBlock[] = [{ label: 'route:about', slug: 'about', code: 'window.__routeRan = true' }]
    const filename = await writeAppJs(join(src, 'app.ts'), dist, blocks)
    const bundled = await readFile(join(dist, filename), 'utf8')

    expect(filename).toMatch(/^app\.[a-f0-9]+\.js$/)
    expect(bundled).toContain('bundled')
    expect(bundled).toContain("window.snz?.onPage('about'")
    expect(bundled).toContain('window.__routeRan = true')
  })

  test('registers component lifecycle scripts against router runtime API', async () => {
    const root = await makeTempDir()
    const src = join(root, 'src')
    const dist = join(root, 'dist', 'assets', 'js')
    await mkdir(src, { recursive: true })
    await writeFile(join(src, 'app.js'), 'window.__appLoaded = true\n')

    const blocks = componentScriptBlocks(new Map([['Counter', ['window.__mountedComponent = el.dataset.snzComponent']]]))
    const filename = await writeAppJs(join(src, 'app.js'), dist, blocks)
    const bundled = await readFile(join(dist, filename), 'utf8')

    expect(bundled).toContain("window.snz?._registerComponent('Counter'")
    expect(bundled).toContain('window.__mountedComponent = el.dataset.snzComponent')
  })

  test('inlines PUBLIC env values without private env values', async () => {
    process.env.PUBLIC_TEST_VALUE = 'public-ok'
    process.env.SECRET_TEST_VALUE = 'secret-no'

    const root = await makeTempDir()
    const src = join(root, 'src')
    const dist = join(root, 'dist', 'assets', 'js')
    await mkdir(src, { recursive: true })
    await writeFile(join(src, 'app.js'), 'window.__public = process.env.PUBLIC_TEST_VALUE\nwindow.__secret = process.env.SECRET_TEST_VALUE\n')

    const filename = await writeAppJs(join(src, 'app.js'), dist, [])
    const bundled = await readFile(join(dist, filename), 'utf8')

    expect(bundled).toContain('public-ok')
    expect(bundled).not.toContain('secret-no')
  })
})
