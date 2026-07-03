import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { createBuildContext } from '../build/build-context'
import { runChecks } from '../build/check'
import { build } from '../build/index'

async function writeMinimalProject(dir: string) {
  await mkdir(join(dir, 'src', 'components'), { recursive: true })
  await mkdir(join(dir, 'src', 'pages'), { recursive: true })
  await mkdir(join(dir, 'src', 'styles'), { recursive: true })
  await mkdir(join(dir, 'src', 'images'), { recursive: true })
  await mkdir(join(dir, 'src', 'videos'), { recursive: true })
  await mkdir(join(dir, 'src', 'files'), { recursive: true })

  await writeFile(join(dir, 'src', 'site.json'), JSON.stringify({
    name: 'Context Fixture',
    url: 'https://example.com',
    description: 'Temp project used to prove context-aware framework APIs.',
    locale: 'en',
    scroll: 'native',
  }, null, 2))

  await writeFile(join(dir, 'src', 'components', 'SEO.html'), await readFile(join(process.cwd(), 'src', 'components', 'SEO.html'), 'utf8'))
  await writeFile(join(dir, 'src', 'shell.html'), `<!doctype html>
<html lang="{{locale}}" data-scroll="{{scroll}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <SEO path="/" />
  <link rel="stylesheet" href="/assets/css/styles.css">
  <!-- @snz-components-css -->
  <script src="/router.js" type="module"></script>
  <script src="/assets/js/app.js" type="module"></script>
</head>
<body>
  <main data-route-root></main>
</body>
</html>
`)
  await writeFile(join(dir, 'src', 'pages', 'index.html'), '<h1>Context fixture</h1>')
  await writeFile(join(dir, 'src', 'styles.css'), ':root{color-scheme:light}body{margin:0;font-family:sans-serif}')
  await writeFile(join(dir, 'src', 'app.ts'), 'export {}\n')
}

describe('build API spine', () => {
  test('creates context from current project paths and flags', () => {
    const context = createBuildContext({ argv: ['bun', 'build/index.ts', '--allow-broken-links'] })

    expect(context.rootDir).toBe(process.cwd())
    expect(context.srcDir).toBe(join(process.cwd(), 'src'))
    expect(context.distDir).toBe(join(process.cwd(), 'dist'))
    expect(context.flags.allowBrokenLinks).toBe(true)
  })

  test('exposes build without running CLI side effects on import', () => {
    expect(typeof build).toBe('function')
  })

  test('builds and checks an explicit non-cwd project context', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'snz-bp-context-'))
    try {
      await writeMinimalProject(dir)
      const context = createBuildContext({ rootDir: dir })

      const result = await build({ context })
      const report = await runChecks({ context })

      expect(result.routes).toContain('index')
      expect(report.errors).toEqual([])
      expect(await Bun.file(join(dir, 'dist', 'index.html')).exists()).toBe(true)
      expect(await Bun.file(join(dir, 'dist', 'routes', 'index.html')).exists()).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
