import { afterEach, describe, expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const packageRoot = join(import.meta.dir, '..')
const starterSrc = join(packageRoot, '..', 'templates', 'default', 'src')
const tempDirs: string[] = []

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) await rm(dir, { recursive: true, force: true })
})

async function makeProject(body: string, site: Record<string, unknown> = {}, head = '') {
  const dir = await mkdtemp(join(tmpdir(), 'snz-launch-'))
  tempDirs.push(dir)
  await mkdir(join(dir, 'src', 'components'), { recursive: true })
  await mkdir(join(dir, 'src', 'pages'), { recursive: true })
  await mkdir(join(dir, 'src', 'images'), { recursive: true })
  // The starter ships a 1×1 placeholder; upscale it so launch fixtures have a real-sized OG master.
  await new Bun.Image(join(starterSrc, 'images', 'og.png')).resize(1200, 630, { fit: 'fill' }).png().write(join(dir, 'src', 'images', 'og.png'))

  await writeFile(join(dir, 'src', 'site.json'), JSON.stringify({
    name: 'Launch Site',
    url: 'https://launch.example.org',
    description: 'Launch-ready fixture for semantic quality checks.',
    locale: 'en',
    image: '/assets/og.webp',
    ...site,
  }))
  await writeFile(join(dir, 'src', 'shell.html'), `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="/assets/css/styles.css">
  <script src="/router.js" type="module"></script>${head}
</head>
<body><main></main></body>
</html>
`)
  await writeFile(join(dir, 'src', 'styles.css'), 'body{font-family:system-ui}\n')
  await writeFile(join(dir, 'src', 'pages', 'index.html'), body)
  return dir
}

async function runCli(dir: string, ...args: string[]) {
  const proc = Bun.spawn(['bun', join(packageRoot, 'cli', 'sttc.ts'), ...args], {
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

async function runDoctorLaunch(dir: string) {
  return runCli(dir, 'doctor', '--launch')
}

describe('launch doctor gate', () => {
  test('passes launch-ready semantic fixture and accepts decorative alt', async () => {
    const dir = await makeProject(`<head>
  <SEO title="Home" description="Launch fixture home page with specific helpful description for visitors." />
</head>
<h1>Launch fixture</h1>
<p><a href="/">Return to launch fixture home</a></p>
<img src="/assets/og.webp" alt="">
`)

    const result = await runDoctorLaunch(dir)

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('launch check ok')
    expect(result.stderr).not.toContain('image missing alt')
  })

  test('keeps normal check free of launch-only blockers', async () => {
    const dir = await makeProject(`<head>
  <SEO title="Home" description="Short." />
</head>
<p><a href="http://localhost:3000/contact/">click here</a></p>
<img src="/assets/og.webp">
`, { url: 'http://localhost:3000', image: '' })

    const result = await runCli(dir, 'check')

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('check ok')
    expect(result.stderr).not.toContain('launch site.url')
  })

  test('fails on missing alt, missing H1, private URL, and placeholder site config', async () => {
    const dir = await makeProject(`<head>
  <SEO title="Home" description="Short." />
</head>
<p><a href="http://localhost:3000/contact/">click here</a></p>
<img src="/assets/og.webp">
`, { url: 'http://localhost:3000', image: '' })

    const result = await runDoctorLaunch(dir)

    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain('src/site.json: launch site.url must be a public https URL')
    expect(result.stderr).toContain('src/site.json: launch image missing')
    expect(result.stderr).toContain('missing H1')
    expect(result.stderr).toContain('image missing alt')
    expect(result.stderr).toContain('private URL in output')
    expect(result.stderr).toContain('vague link text "click here"')
    expect(result.stderr).toContain('weak meta description')
  })

  test('reports duplicate titles/descriptions and icon-only links', async () => {
    const dir = await makeProject(`<head>
  <SEO title="Shared" description="Shared route description with enough detail for a launch check." />
</head>
<h1>Home</h1>
<p><a href="/about/" aria-label="About the launch fixture"><svg aria-hidden="true"></svg></a></p>
`)
    await writeFile(join(dir, 'src', 'pages', 'about.html'), `<head>
  <SEO title="Shared" description="Shared route description with enough detail for a launch check." />
</head>
<h1>About</h1>
<p><a href="/"><svg aria-hidden="true"></svg></a></p>
`)

    const result = await runDoctorLaunch(dir)

    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain('duplicate page title')
    expect(result.stderr).toContain('duplicate meta description')
    expect(result.stderr).toContain('link has no accessible name')
  })

  test('fails on placeholder OG master and starter copy', async () => {
    const starterSite = JSON.parse(await readFile(join(starterSrc, 'site.json'), 'utf8'))
    const dir = await makeProject(await readFile(join(starterSrc, 'pages', 'index.html'), 'utf8'), { name: starterSite.name, description: starterSite.description })
    await cp(join(starterSrc, 'components'), join(dir, 'src', 'components'), { recursive: true })
    await cp(join(starterSrc, 'images', 'og.png'), join(dir, 'src', 'images', 'og.png'))

    const result = await runDoctorLaunch(dir)

    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain('launch OG master is 1×1; needs at least 600×315')
    expect(result.stderr).toContain(`launch name is the starter's placeholder "${starterSite.name}"`)
    expect(result.stderr).toContain(`launch description is the starter's placeholder "${starterSite.description}"`)
    expect(result.stderr).toContain("src/pages/index.html: launch title is the starter's placeholder")
  })

  test('fails on missing OG master', async () => {
    const dir = await makeProject(`<head>
  <SEO title="Home" description="Launch fixture home page with specific helpful description for visitors." />
</head>
<h1>Launch fixture</h1>
`)
    await rm(join(dir, 'src', 'images', 'og.png'))

    const result = await runDoctorLaunch(dir)

    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain('launch OG master missing')
  })

  test('head emit contracts pass check and warn under --launch', async () => {
    const dir = await makeProject(`<head>
  <SEO title="Home" description="Launch fixture home page with specific helpful description for visitors." />
</head>
<h1>Launch fixture</h1>
`, {}, `
  <link rel="stylesheet" href="/assets/files/a.css">
  <link rel="stylesheet" href="/assets/files/b.css">
  <script src="/assets/files/plain.js"></script>`)
    await mkdir(join(dir, 'src', 'files'))
    for (const file of ['a.css', 'b.css']) await writeFile(join(dir, 'src', 'files', file), '@import "x.css";\n')
    await writeFile(join(dir, 'src', 'files', 'plain.js'), '')

    const check = await runCli(dir, 'check')
    expect(check.code).toBe(0)
    expect(check.stderr).not.toContain('render-blocking')

    const launch = await runDoctorLaunch(dir)
    expect(launch.code).toBe(0)
    expect(launch.stderr).toContain('render-blocking stylesheets')
    expect(launch.stderr).toContain('render-blocking script /assets/files/plain.js')
  })

  test('check --launch runs launch checks without CSS audit', async () => {
    const dir = await makeProject(`<head>
  <SEO title="Home" description="Launch fixture home page with specific helpful description for visitors." />
</head>
<h1>Launch fixture</h1>
<p><a href="/">Return to launch fixture home</a></p>
`)

    const result = await runCli(dir, 'check', '--launch')

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('launch check ok')
    expect(result.stdout).not.toContain('CSS ownership audit')
  })
})
