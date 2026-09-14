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
  }, null, 2))

  await writeFile(join(dir, 'src', 'shell.html'), `<!doctype html>
<html lang="{{locale}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- @snz-components-css -->
  <script src="/router.js" type="module"></script>
  <script src="/assets/js/app.js" type="module"></script>
</head>
<body>
  <main></main>
</body>
</html>
`)
  await writeFile(join(dir, 'src', 'pages', 'index.html'), '<h1>Context fixture</h1>')
  await writeFile(join(dir, 'src', 'pages', '404.html'), '<h1>Not found</h1>')
  await writeFile(join(dir, 'src', 'styles.css'), ':root{color-scheme:light}body{margin:0;font-family:sans-serif}')
  await writeFile(join(dir, 'src', 'app.ts'), 'export {}\n')
  await writeFile(join(dir, 'src', 'files', 'manual.html'), '<!doctype html><title>Raw manual</title><p>Public raw file</p>\n')
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

  test('serializes concurrent builds for the same project', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sttc-lock-'))
    try {
      await writeMinimalProject(dir)
      const context = createBuildContext({ rootDir: dir })
      const results = await Promise.all([build({ context }), build({ context })])
      expect(results.every((result) => result.routes.includes('index'))).toBe(true)
      expect((await runChecks({ context })).errors).toEqual([])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('excludes Lenis code and assets from native-scroll builds', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sttc-scroll-'))
    try {
      await writeMinimalProject(dir)
      await mkdir(join(dir, 'src', 'app', 'vendor'), { recursive: true })
      await writeFile(join(dir, 'src', 'app', 'scroll.js'), 'window.lenisBootstrap = true\n')
      await writeFile(join(dir, 'src', 'app', 'vendor', 'lenis.min.js'), 'window.Lenis = class {}\n')
      await writeFile(join(dir, 'src', 'styles', 'lenis.css'), '.lenis{scroll-behavior:auto}\n')
      const shellFile = join(dir, 'src', 'shell.html')
      const shell = (await readFile(shellFile, 'utf8'))
        .replace('<html lang="{{locale}}">', '<html lang="{{locale}}" data-scroll="{{scroll}}">')
        .replace('  <script src="/assets/js/app.js"', '  <script src="/assets/js/scroll.js" defer></script>\n  <script src="/assets/js/app.js"')
      await writeFile(shellFile, shell)
      const siteFile = join(dir, 'src', 'site.json')
      const site = JSON.parse(await readFile(siteFile, 'utf8'))
      const context = createBuildContext({ rootDir: dir })

      await writeFile(siteFile, JSON.stringify({ ...site, scroll: 'lenis' }, null, 2))
      await build({ context })
      expect(await Bun.file(join(dir, 'dist', 'assets', 'js', 'scroll.js')).exists()).toBe(true)
      expect(await Bun.file(join(dir, 'dist', 'assets', 'js', 'vendor', 'lenis.min.js')).exists()).toBe(true)
      expect(await Bun.file(join(dir, 'dist', 'assets', 'css', 'lenis.css')).exists()).toBe(true)
      expect(await Bun.file(join(dir, 'dist', 'index.html')).text()).toContain('data-scroll="lenis"')

      await writeFile(siteFile, JSON.stringify({ ...site, scroll: 'native' }, null, 2))
      await build({ context })
      const nativeHtml = await Bun.file(join(dir, 'dist', 'index.html')).text()
      expect(nativeHtml).not.toContain('data-scroll')
      expect(nativeHtml).not.toContain('scroll.js')
      expect(await Bun.file(join(dir, 'dist', 'assets', 'js', 'scroll.js')).exists()).toBe(false)
      expect(await Bun.file(join(dir, 'dist', 'assets', 'js', 'vendor', 'lenis.min.js')).exists()).toBe(false)
      expect(await Bun.file(join(dir, 'dist', 'assets', 'css', 'lenis.css')).exists()).toBe(false)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('prunes unused component CSS and lifecycle code after transitive composition', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sttc-prune-'))
    try {
      await writeMinimalProject(dir)
      const components = join(dir, 'src', 'components')
      await writeFile(join(components, 'Used.html'), `<article><Inner /></article>\n<style>.used-marker{color:green}</style>\n<script>window.__used = el</script>\n`)
      await writeFile(join(components, 'Inner.html'), `<span>{{slot}}</span>\n<style>.inner-marker{color:blue}</style>\n<script>window.__inner = el</script>\n`)
      await writeFile(join(components, 'Unused.html'), `<aside></aside>\n<style>.unused-marker{color:red}</style>\n<script>window.__unused = el</script>\n`)
      await writeFile(join(dir, 'src', 'pages', 'index.html'), '<h1>Context fixture</h1><Used />')

      const result = await build({ context: createBuildContext({ rootDir: dir }) })
      const cssFiles = (await (await import('fs/promises')).readdir(join(dir, 'dist', 'assets', 'css')))
        .filter((file) => /^components\..+\.css$/.test(file))
      const css = await readFile(join(dir, 'dist', 'assets', 'css', cssFiles[0]!), 'utf8')
      const app = await readFile(join(dir, 'dist', 'assets', 'js', result.appJsFile), 'utf8')
      const html = await readFile(join(dir, 'dist', 'index.html'), 'utf8')

      expect(cssFiles).toHaveLength(1)
      expect(css).toContain('.used-marker')
      expect(css).toContain('.inner-marker')
      expect(css).not.toContain('.unused-marker')
      expect(app).toContain('_registerComponent("Used"')
      expect(app).toContain('_registerComponent("Inner"')
      expect(app).not.toContain('_registerComponent("Unused"')
      expect(html.match(/components\.[a-f0-9]+\.css/g)).toHaveLength(1)
      expect(html.match(/app\.[a-f0-9]+\.js/g)).toHaveLength(1)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('fails instead of silently ignoring forwarded Image encode controls', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sttc-image-plan-'))
    try {
      await writeMinimalProject(dir)
      const components = join(dir, 'src', 'components')
      await writeFile(join(components, 'Image.html'), '<div>{{imgMain}}</div>')
      await writeFile(join(components, 'Picture.html'), '<Image src="{{src}}" alt="{{alt}}" max="{{max}}" />')
      await writeFile(join(dir, 'src', 'pages', 'index.html'), '<h1>Image</h1><Picture src="hero" alt="Hero" max="800" />')
      await Bun.write(join(dir, 'src', 'images', 'hero.png'), Bun.file('templates/default/src/images/og.png'))

      await expect(build({ context: createBuildContext({ rootDir: dir }) })).rejects.toThrow(
        'dynamic max or quality that cannot be planned before encoding',
      )
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('builds and checks an explicit non-cwd project context', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sttc-context-'))
    try {
      await writeMinimalProject(dir)
      const context = createBuildContext({ rootDir: dir })

      const result = await build({ context })
      const report = await runChecks({ context })

      expect(result.routes).toContain('index')
      expect(report.errors).toEqual([])
      expect(await Bun.file(join(dir, 'dist', 'index.html')).exists()).toBe(true)
      expect(await Bun.file(join(dir, 'dist', '404.html')).exists()).toBe(true)
      expect(await Bun.file(join(dir, 'dist', 'routes', 'index.html')).exists()).toBe(false)
      const html = await Bun.file(join(dir, 'dist', 'index.html')).text()
      const styles = html.match(/\/assets\/css\/styles\.[a-f0-9]+\.css/)
      expect(styles?.[0]).toBeTruthy()
      expect(await Bun.file(join(dir, 'dist', styles![0])).exists()).toBe(true)
      expect(html).toMatch(/\/assets\/js\/router\.[a-f0-9]+\.js/)
      expect(html).not.toContain('src="/router.js"')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
