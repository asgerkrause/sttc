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

async function startDevServer(cwd = process.cwd()) {
  const proc = Bun.spawn(['bun', join(packageRoot, 'dev.ts')], {
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
    const match = output.match(/http:\/\/localhost:(\d+)/)
    if (match) {
      ready = true
      resolveReady(`http://localhost:${match[1]}`)
    }
  }

  void readStream(proc.stdout, append)
  void readStream(proc.stderr, append)
  void proc.exited.then((code) => {
    if (!ready) rejectReady(new Error(`dev server exited with ${code}\n${output}`))
  })

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`dev server did not become ready\n${output}`)), 30_000)
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
  await writeFile(join(dir, 'src', 'styles.css'), 'body{margin:0}')
  await writeFile(join(dir, 'src', 'app.ts'), 'export {}\n')
  return dir
}

describe('dev server smoke', () => {
  test('rebuilds changed and deleted source files without stale cooldown drops', async () => {
    const dir = await makeDevProject()
    const base = await startDevServer(dir)
    expect((await text(`${base}/routes/index.html`)).body).toContain('Before rebuild')

    const publicFile = join(dir, 'src', 'files', 'watch.txt')
    await mkdir(join(publicFile, '..'), { recursive: true })
    await writeFile(publicFile, 'watched file')
    await waitFor(async () => (await text(`${base}/assets/files/watch.txt`)).response.status === 200)

    await writeFile(join(dir, 'src', 'pages', 'index.html'), '<h1>After rebuild</h1>')
    await waitFor(async () => (await text(`${base}/routes/index.html`)).body.includes('After rebuild'))

    await rm(publicFile)
    await waitFor(async () => (await text(`${base}/assets/files/watch.txt`)).response.status === 404)

    const hmr = await text(`${base}/__snz/hmr.js`)
    expect(hmr.body).toContain('location.reload()')
    expect(hmr.body).not.toContain('window.snz?._reload')
  }, 30_000)

  test('serves built pages, route fragments, SPA fallback, and 404 fragments', async () => {
    const base = await startDevServer()

    const home = await text(`${base}/`)
    expect(home.response.status).toBe(200)
    expect(home.body).toContain('<main>')
    expect(home.body).toContain('<script src="/__snz/hmr.js"></script>')

    const notFoundPage = await text(`${base}/404/index.html`)
    expect(notFoundPage.response.status).toBe(200)
    expect(notFoundPage.body).toContain('Not found')
    expect(notFoundPage.body).toContain('<script src="/__snz/hmr.js"></script>')

    const missingFragment = await text(`${base}/routes/not-real.html`)
    expect(missingFragment.response.status).toBe(404)

    const notFoundFragment = await text(`${base}/routes/404.html`)
    expect(notFoundFragment.response.status).toBe(200)
    expect(notFoundFragment.body).toContain('Not found')

    const fallback = await text(`${base}/not-real/`)
    expect(fallback.response.status).toBe(200)
    expect(fallback.body).toContain('<main>')
    expect(fallback.body).toContain('<script src="/__snz/hmr.js"></script>')
  }, 40_000)
})
