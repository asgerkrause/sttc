import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readdir, readFile, rm, stat, utimes, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const tempDirs: string[] = []
const packageRoot = join(import.meta.dir, '..')

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) await rm(dir, { recursive: true, force: true })
})

async function makeProject(options: { siteJson?: string, body?: string } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'snz-atomic-dist-'))
  tempDirs.push(dir)

  await mkdir(join(dir, 'src', 'components'), { recursive: true })
  await mkdir(join(dir, 'src', 'pages'), { recursive: true })
  await mkdir(join(dir, 'src', 'styles'), { recursive: true })
  await mkdir(join(dir, 'dist'), { recursive: true })

  await writeFile(join(dir, 'src', 'site.json'), options.siteJson ?? JSON.stringify({
    name: 'Atomic Dist',
    url: 'https://example.com',
    description: 'Atomic build fixture.',
    locale: 'en',
  }))
  await writeFile(join(dir, 'src', 'shell.html'), `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="/assets/css/styles.css">
  <script src="/router.js" type="module"></script>
  <script src="/assets/js/app.js" type="module"></script>
</head>
<body>
  <main></main>
</body>
</html>
`)
  await writeFile(join(dir, 'src', 'styles.css'), 'body{font-family:system-ui}\n')
  await writeFile(join(dir, 'src', 'app.ts'), 'window.__atomicDist = true\n')
  await writeFile(join(dir, 'src', 'pages', 'index.html'), `<head>
  <SEO title="Home" description="Home page." path="/" />
</head>
${options.body ?? '<h1>Home body</h1>'}
`)
  await writeFile(join(dir, 'src', 'pages', '404.html'), '<h1>Not found</h1>\n')
  await writeFile(join(dir, 'dist', 'keep.txt'), 'old dist')
  await writeFile(join(dir, 'dist', 'stale.txt'), 'stale output')

  return dir
}

async function distSwapTemps(dir: string) {
  return (await readdir(dir)).filter((entry) => entry.startsWith('dist.__next-') || entry.startsWith('dist.__prev-'))
}

async function runBuild(dir: string) {
  const proc = Bun.spawn(['bun', join(packageRoot, 'build', 'index.ts')], {
    cwd: dir,
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { code, stdout, stderr }
}

describe('atomic dist build', () => {
  test('keeps previous dist when build fails before swap', async () => {
    const dir = await makeProject({ siteJson: '{ nope' })

    const result = await runBuild(dir)

    expect(result.code).not.toBe(0)
    expect(await readFile(join(dir, 'dist', 'keep.txt'), 'utf8')).toBe('old dist')
    expect(await Bun.file(join(dir, 'dist', 'index.html')).exists()).toBe(false)
    expect(await distSwapTemps(dir)).toEqual([])
  })

  test('restores previous dist when strict check fails after swap', async () => {
    const dir = await makeProject({ body: '<h1>Home body</h1><a href="/missing/">Missing</a>' })

    const result = await runBuild(dir)

    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain('broken route /missing/')
    expect(await readFile(join(dir, 'dist', 'keep.txt'), 'utf8')).toBe('old dist')
    expect(await readFile(join(dir, 'dist', 'stale.txt'), 'utf8')).toBe('stale output')
    expect(await distSwapTemps(dir)).toEqual([])
  })

  test('reuses image encodes across atomic stages and prunes deleted masters', async () => {
    const dir = await makeProject()
    const imageDir = join(dir, 'src', 'images')
    const imagePath = join(imageDir, 'hero.png')
    const png = 'iVBORw0KGgoAAAANSUhEUgAAADwAAABaCAIAAABrM6JiAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAPKADAAQAAAABAAAAWgAAAACdrWuxAAAA4klEQVRoBe3SwQkAIRDF0NH+e97tIKcgDMRr4CNPzzf7zt135Zku/erVkk4aBPoegKOmpFVOGEsacNSUtMoJY0kDjpqSVjlhLGnAUVPSKieMJQ04akpa5YSxpAFHTUmrnDCWNOCoKWmVE8aSBhw1Ja1ywljSgKOmpFVOGEsacNSUtMoJY0kDjpqSVjlhLGnAUVPSKieMJQ04akpa5YSxpAFHTUmrnDCWNOCoKWmVE8aSBhw1Ja1ywljSgKOmpFVOGEsacNSUtMoJY0kDjpqSVjlhLGnAUVPSKieMJQ04alop/QME/wGzn3VIjwAAAABJRU5ErkJggg=='
    await mkdir(imageDir, { recursive: true })
    await writeFile(imagePath, Buffer.from(png, 'base64'))

    const first = await runBuild(dir)
    const second = await runBuild(dir)
    expect(first.code).toBe(0)
    expect(first.stdout).toContain('image hero.png')
    expect(second.code).toBe(0)
    expect(second.stdout).not.toContain('image hero.png')
    expect(await Bun.file(join(dir, 'dist', 'assets', 'images', 'hero.webp')).exists()).toBe(true)

    const originalMtime = (await stat(imagePath)).mtime
    const recompressed = await new Bun.Image(Buffer.from(png, 'base64')).png({ compressionLevel: 9 }).bytes()
    await writeFile(imagePath, recompressed)
    await utimes(imagePath, originalMtime, originalMtime)
    expect((await stat(imagePath)).mtimeMs).toBe(originalMtime.getTime())
    const sameMtimeChange = await runBuild(dir)
    expect(sameMtimeChange.code).toBe(0)
    expect(sameMtimeChange.stdout).toContain('image hero.png')

    await rm(imagePath)
    const afterDelete = await runBuild(dir)
    expect(afterDelete.code).toBe(0)
    expect(await Bun.file(join(dir, 'dist', 'assets', 'images', 'hero.webp')).exists()).toBe(false)
  })

  test('removes stale output after successful swap', async () => {
    const dir = await makeProject()

    const result = await runBuild(dir)

    expect(result.code).toBe(0)
    expect(await Bun.file(join(dir, 'dist', 'stale.txt')).exists()).toBe(false)
    expect(await readFile(join(dir, 'dist', 'index.html'), 'utf8')).toContain('<h1 id="home-body">Home body</h1>')
    expect(await Bun.file(join(dir, 'dist', '404.html')).exists()).toBe(true)
    expect(await distSwapTemps(dir)).toEqual([])
  })
})
