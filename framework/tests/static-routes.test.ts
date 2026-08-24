import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const tempDirs: string[] = []
const packageRoot = join(import.meta.dir, '..')

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) await rm(dir, { recursive: true, force: true })
})

async function makeProject() {
  const dir = await mkdtemp(join(tmpdir(), 'snz-static-routes-'))
  tempDirs.push(dir)

  await mkdir(join(dir, 'src', 'components'), { recursive: true })
  await mkdir(join(dir, 'src', 'pages', 'work'), { recursive: true })
  await mkdir(join(dir, 'src', 'styles'), { recursive: true })
  await mkdir(join(dir, 'src', 'images'), { recursive: true })

  await writeFile(join(dir, 'src', 'site.json'), JSON.stringify({
    name: 'Static Routes',
    url: 'https://example.com',
    description: 'Static route test site.',
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
  await writeFile(join(dir, 'src', 'components', 'Accordion.html'), `<!--
  @desc FAQ accordion.
  @attr summary! Question.
  @attr body! Answer.
-->
<details><summary>{{summary}}</summary>{{body}}</details>
<style>
  details { color: red; }
</style>
`)
  await writeFile(join(dir, 'src', 'styles.css'), 'body{font-family:system-ui}\n')
  await writeFile(join(dir, 'src', 'images', 'case.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'))
  await writeFile(join(dir, 'src', 'app.ts'), 'window.__staticRoutesTest = true\n')
  await writeFile(join(dir, 'src', 'pages', 'index.html'), `<head>
  <SEO title="Home" description="Home page." />
</head>
<h1>Home body</h1>
`)
  await writeFile(join(dir, 'src', 'pages', 'work', 'case.html'), `<head>
  <SEO title="Case" description="Case page." image="/assets/images/case.webp" />
</head>
<h1>Case body</h1>
<Accordion summary="What changes?" body="<p>Direct route HTML keeps schema.</p>" />
<a href="/">Home</a>
<style>
  .case-note { color: blue; }
</style>
`)

  return dir
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
  if (code !== 0) throw new Error(`build failed\n${stdout}\n${stderr}`)
}

describe('static public routes', () => {
  test('emits full public pages while preserving router body routes', async () => {
    const dir = await makeProject()

    await runBuild(dir)

    const home = await readFile(join(dir, 'dist', 'index.html'), 'utf8')
    const deep = await readFile(join(dir, 'dist', 'work', 'case', 'index.html'), 'utf8')
    const routerBody = await readFile(join(dir, 'dist', 'routes', 'work', 'case.html'), 'utf8')

    expect(home).toContain('<html data-snz-route="index" lang="en">')
    expect(home).toContain('<main>\n<h1 id="home-body">Home body</h1>')
    expect(home).toContain('<script src="/assets/js/app.')
    expect(deep).toContain('<html data-snz-route="work/case" lang="en">')
    expect(deep).toContain('<title data-snz-head>Case</title>')
    expect(deep).toContain('<link rel="canonical" href="https://example.com/work/case/" data-snz-head>')
    expect(deep).toContain('<link rel="alternate" type="text/markdown" href="/work/case/index.md" data-snz-head>')
    expect(deep).toContain('<link rel="describedby" href="/llms.txt" data-snz-head>')
    expect(deep).toContain('"@type":"BreadcrumbList"')
    expect(deep).toContain('<meta property="og:image" content="https://example.com/assets/images/case.webp" data-snz-head>')
    expect(deep).toContain('<meta name="twitter:image" content="https://example.com/assets/images/case.webp" data-snz-head>')
    expect(deep).toContain('<main>\n<h1 id="case-body">Case body</h1>')
    expect(deep).not.toContain('"@type":"FAQPage"')
    expect(deep).toContain('What changes?')
    expect(deep).toContain('href="/assets/css/components.')
    expect(deep).toMatch(/href="\/assets\/css\/routes\/work-case\.[^"]+" data-snz-route-css data-snz-head>/)
    expect(deep.indexOf('/assets/css/components.')).toBeLessThan(deep.indexOf('/assets/css/routes/work-case.'))
    expect(deep).not.toContain('<style>')
    expect(routerBody).toContain('<head>')
    expect(routerBody).not.toContain('<html data-snz-route=')
    expect(routerBody).toContain('href="/assets/css/routes/work-case.')
    expect(routerBody).toContain('<h1 id="case-body">Case body</h1>')
    expect(routerBody).not.toContain('<style>')
    expect(routerBody).not.toContain('<main>')
    expect(await readFile(join(dir, 'dist', 'work', 'case', 'index.md'), 'utf8')).toContain('# Case body')
    expect(await readFile(join(dir, 'dist', 'index.md'), 'utf8')).toContain('# Home body')

    const routeCssFile = (await readdir(join(dir, 'dist', 'assets', 'css', 'routes'))).find((file) => file.startsWith('work-case.'))
    expect(routeCssFile).toBeTruthy()
    const routeCss = await readFile(join(dir, 'dist', 'assets', 'css', 'routes', routeCssFile!), 'utf8')
    expect(routeCss).toContain('@layer snz.pages.work-case {')
    expect(routeCss).toContain('.case-note { color: blue; }')

    const componentCssFile = (await readdir(join(dir, 'dist', 'assets', 'css'))).find((file) => /^components\.[a-f0-9]+\.css$/.test(file))
    expect(componentCssFile).toBeTruthy()
    const componentCss = await readFile(join(dir, 'dist', 'assets', 'css', componentCssFile!), 'utf8')
    expect(componentCss).toContain('@layer snz.components {')
  })
})
