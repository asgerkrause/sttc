import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { createComposer } from '../build/compose'
import { BuildError } from '../build/errors'

const tempDirs: string[] = []
const packageRoot = join(import.meta.dir, '..')
const png = 'iVBORw0KGgoAAAANSUhEUgAAADwAAABaCAIAAABrM6JiAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAPKADAAQAAAABAAAAWgAAAACdrWuxAAAA4klEQVRoBe3SwQkAIRDF0NH+e97tIKcgDMRr4CNPzzf7zt135Zku/erVkk4aBPoegKOmpFVOGEsacNSUtMoJY0kDjpqSVjlhLGnAUVPSKieMJQ04akpa5YSxpAFHTUmrnDCWNOCoKWmVE8aSBhw1Ja1ywljSgKOmpFVOGEsacNSUtMoJY0kDjpqSVjlhLGnAUVPSKieMJQ04akpa5YSxpAFHTUmrnDCWNOCoKWmVE8aSBhw1Ja1ywljSgKOmpFVOGEsacNSUtMoJY0kDjpqSVjlhLGnAUVPSKieMJQ04alop/QME/wGzn3VIjwAAAABJRU5ErkJggg=='

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) await rm(dir, { recursive: true, force: true })
})

function composer() {
  return createComposer(
    new Map([
      ['SEO', '<title>{{title}}</title>'],
      ['Card', '<article><header>{{slot:title}}</header><div>{{slot}}</div></article>'],
      ['Badge', '<span class="badge"><b></b>{{slot:label}}{{slot}}</span>'],
    ]),
    new Map(),
    () => ({}),
  )
}

async function catchBuildError(promise: Promise<unknown>) {
  try {
    await promise
  } catch (err) {
    if (err instanceof BuildError) return err
    throw err
  }
  throw new Error('expected BuildError')
}

describe('engine correctness', () => {
  test('nested named slots resolve by depth, not by the first closing tag', async () => {
    const html = await composer().prepareRouteSource(
      '<Card><slot name="title"><Badge><slot name="label">LBL</slot>badge-body</Badge> title-tail</slot>card-body</Card>',
      { slug: 'page', fileHint: 'src/pages/page.html' },
    )
    expect(html).toContain(
      '<article><header><span class="badge"><b></b>LBLbadge-body</span> title-tail</header><div>card-body</div></article>',
    )
    expect(html).not.toMatch(/<slot\b/)
  })

  test('route error lines count the stripped <head> wrapper', async () => {
    const err = await catchBuildError(composer().prepareRouteSource(
      '<head><SEO title="x" /></head>\n\n<Faqq />',
      { slug: 'page', fileHint: 'src/pages/page.html' },
    ))
    expect(err.file).toBe('src/pages/page.html')
    expect(err.line).toBe(3)
  })

  test('unclosed route {#if} names the route file', async () => {
    const err = await catchBuildError(composer().prepareRouteSource(
      '<head><SEO title="x" /></head>\n<p>{#if x}open</p>',
      { slug: 'page', fileHint: 'src/pages/page.html', data: { x: 'y' } },
    ))
    expect(err.message).toContain('Unclosed component conditional block')
    expect(err.file).toBe('src/pages/page.html')
  })

  test('build writes image sidecars outside dist and ships no .meta directory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'snz-engine-cache-'))
    tempDirs.push(dir)
    await mkdir(join(dir, 'src', 'pages'), { recursive: true })
    await mkdir(join(dir, 'src', 'images'), { recursive: true })
    await mkdir(join(dir, 'src', 'styles'), { recursive: true })
    await writeFile(join(dir, 'src', 'site.json'), JSON.stringify({ name: 'Engine', url: 'https://example.com', description: 'Engine fixture.', locale: 'en' }))
    await writeFile(join(dir, 'src', 'shell.html'), '<!doctype html>\n<html lang="en">\n<head>\n<script src="/router.js" type="module"></script>\n</head>\n<body><main></main></body>\n</html>\n')
    await writeFile(join(dir, 'src', 'styles.css'), 'body{font-family:system-ui}\n')
    await writeFile(join(dir, 'src', 'app.ts'), 'window.__engine = true\n')
    await writeFile(join(dir, 'src', 'pages', 'index.html'), '<head>\n  <SEO title="Home" description="Home page." path="/" />\n</head>\n<h1>Home</h1>\n')
    await writeFile(join(dir, 'src', 'pages', '404.html'), '<h1>Not found</h1>\n')
    await writeFile(join(dir, 'src', 'images', 'portrait.png'), Buffer.from(png, 'base64'))

    const proc = Bun.spawn(['bun', join(packageRoot, 'build', 'index.ts')], { cwd: dir, stdout: 'ignore', stderr: 'inherit', env: process.env })
    const code = await proc.exited
    expect(code).toBe(0)

    const found: string[] = []
    const walk = async (path: string) => {
      for (const entry of await readdir(path, { withFileTypes: true })) {
        const child = join(path, entry.name)
        if (entry.name === '.meta') found.push(child)
        if (entry.isDirectory()) await walk(child)
      }
    }
    await walk(join(dir, 'dist'))
    expect(found).toEqual([])
    expect((await stat(join(dir, 'dist', 'assets', 'images', 'portrait.webp'))).isFile()).toBe(true)
    expect((await stat(join(dir, 'node_modules', '.cache', 'sttc', 'images', 'portrait.json'))).isFile()).toBe(true)
  })
})
