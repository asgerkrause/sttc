import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

const procs: Bun.Subprocess[] = []
const tempDirs: string[] = []
const packageRoot = join(import.meta.dir, '..')

afterEach(async () => {
  for (const proc of procs.splice(0)) {
    proc.kill()
    await proc.exited.catch(() => {})
  }
  for (const dir of tempDirs.splice(0)) await rm(dir, { recursive: true, force: true })
})

function randomPort() {
  return 39000 + Math.floor(Math.random() * 1000)
}

async function readStream(
  stream: ReadableStream<Uint8Array> | null,
  onText: (text: string) => void,
) {
  if (!stream) return
  const decoder = new TextDecoder()
  for await (const chunk of stream) onText(decoder.decode(chunk))
}

async function startServer(script: 'dev.ts' | 'preview.ts', cwd = process.cwd()) {
  const proc = Bun.spawn(['bun', join(packageRoot, script)], {
    cwd,
    env: { ...process.env, PORT: String(randomPort()) },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  procs.push(proc)

  let output = ''
  let resolveReady: (url: string) => void = () => {}
  let rejectReady: (err: Error) => void = () => {}
  let ready = false

  const readyPromise = new Promise<string>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })

  const append = (text: string) => {
    output += text
    if (ready) return
    const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/)
    if (match) {
      ready = true
      resolveReady(`http://127.0.0.1:${match[1]}`)
    }
  }

  void readStream(proc.stdout, append)
  void readStream(proc.stderr, append)
  void proc.exited.then((code) => {
    if (!ready) rejectReady(new Error(`${script} exited with ${code}\n${output}`))
  })

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`${script} did not become ready\n${output}`)), 30_000)
  })

  return Promise.race([readyPromise, timeout])
}

async function text(url: string) {
  const response = await fetch(url)
  return { response, body: await response.text() }
}

async function waitFor(check: () => Promise<boolean>, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await check()) return
    await Bun.sleep(100)
  }
  throw new Error('timed out waiting for dev rebuild')
}

async function makeDevProject() {
  const dir = await mkdtemp(join(tmpdir(), 'snz-dev-watch-'))
  tempDirs.push(dir)
  await mkdir(join(dir, 'src', 'pages'), { recursive: true })
  await mkdir(join(dir, 'src', 'components'), { recursive: true })
  await writeFile(join(dir, 'src', 'site.json'), JSON.stringify({
    name: 'Dev watch fixture',
    url: 'https://example.com',
    description: 'Fixture for real development rebuild behavior.',
    locale: 'en',
  }))
  await writeFile(join(dir, 'src', 'shell.html'), `<!doctype html><html lang="en"><head>
<meta charset="UTF-8"><script src="/router.js" type="module"></script><script src="/assets/js/app.js" type="module"></script>
</head><body><main></main></body></html>`)
  await writeFile(join(dir, 'src', 'pages', 'index.html'), '<h1>Before rebuild</h1>')
  await writeFile(join(dir, 'src', 'pages', '404.html'), '<h1>Not found</h1>')
  await writeFile(join(dir, 'src', 'styles.css'), 'body{margin:0}')
  await writeFile(join(dir, 'src', 'app.ts'), 'export {}\n')
  return dir
}

describe('dev server smoke', () => {
  test('rebuilds changed and deleted source files without stale cooldown drops', async () => {
    const dir = await makeDevProject()
    const base = await startServer('dev.ts', dir)
    expect((await text(`${base}/`)).body).toContain('Before rebuild')

    const publicFile = join(dir, 'src', 'files', 'watch.txt')
    await mkdir(join(publicFile, '..'), { recursive: true })
    await writeFile(publicFile, 'watched file')
    await waitFor(async () => (await text(`${base}/assets/files/watch.txt`)).response.status === 200)

    await writeFile(join(dir, 'src', 'pages', 'index.html'), '<h1>After rebuild</h1>')
    await waitFor(async () => (await text(`${base}/`)).body.includes('After rebuild'))

    await rm(publicFile)
    await waitFor(async () => (await text(`${base}/assets/files/watch.txt`)).response.status === 404)

    const hmr = await text(`${base}/__snz/hmr.js`)
    expect(hmr.body).toContain('location.reload()')
    expect(hmr.body).toContain("addEventListener('build-error'")
    expect(hmr.body).not.toContain('snzBuilding')

    // A broken build serves the error page with the HMR client, so the next good build reloads it.
    await writeFile(join(dir, 'src', 'pages', 'index.html'), "<Missing title='x' />")
    await waitFor(async () => (await text(`${base}/`)).response.status === 500)
    const broken = await text(`${base}/`)
    expect(broken.body).toContain('src/pages/index.html')
    expect(broken.body).toContain('<script src="/__snz/hmr.js" defer></script>')
    await writeFile(join(dir, 'src', 'pages', 'index.html'), '<h1>Fixed</h1>')
    await waitFor(async () => (await text(`${base}/`)).response.status === 200)
  }, 40_000)

  test('serves built pages, refuses traversal, and 404s unknown routes', async () => {
    const base = await startServer('dev.ts')

    const home = await text(`${base}/`)
    expect(home.response.status).toBe(200)
    expect(home.body).toContain('<main>')
    expect(home.body).toContain('<script src="/__snz/hmr.js" defer></script>')

    const notFoundPage = await text(`${base}/404/index.html`)
    expect(notFoundPage.response.status).toBe(200)
    expect(notFoundPage.body).toContain('Not found')
    expect(notFoundPage.body).toContain('<script src="/__snz/hmr.js" defer></script>')

    expect((await text(`${base}/routes/not-real.html`)).response.status).toBe(404)

    for (const url of [`${base}/docs/`, `${base}/docs`]) {
      const docs = await text(url)
      expect(docs.response.status).toBe(200)
      expect(docs.body).toContain('<script src="/__snz/hmr.js" defer></script>')
      expect(docs.body).toBe((await Bun.file(join(process.cwd(), 'dist', 'docs', 'index.html')).text())
        .replace('</body>', '<script src="/__snz/hmr.js" defer></script></body>'))
    }

    const notFound = await text(`${base}/not-real/`)
    expect(notFound.response.status).toBe(404)
    expect(notFound.body).toContain('Not found')
    expect(notFound.body).toContain('<script src="/__snz/hmr.js" defer></script>')

    expect((await text(`${base}/..%2Fpackage.json`)).response.status).toBe(404)
    expect((await text(`${base}/assets/..%2F..%2Fpackage.json`)).response.status).toBe(404)
  }, 40_000)

  test('preview stays inside dist and serves the 404 page for unknown routes', async () => {
    const base = await startServer('preview.ts')

    expect((await text(`${base}/`)).response.status).toBe(200)
    expect((await text(`${base}/..%2Fpackage.json`)).response.status).toBe(404)
    expect((await text(`${base}/assets/..%2F..%2Fpackage.json`)).response.status).toBe(404)

    const notFound = await text(`${base}/does-not-exist/`)
    expect(notFound.response.status).toBe(404)
    expect(notFound.body).toBe(await Bun.file(join(process.cwd(), 'dist', '404', 'index.html')).text())
  }, 40_000)
})
