import { afterEach, describe, expect, test } from 'bun:test'

const procs: Bun.Subprocess[] = []

afterEach(async () => {
  for (const proc of procs.splice(0)) {
    proc.kill()
    await proc.exited.catch(() => {})
  }
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

async function startDevServer() {
  const proc = Bun.spawn(['bun', 'framework/dev.ts'], {
    cwd: process.cwd(),
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

describe('dev server smoke', () => {
  test('serves built pages, route fragments, SPA fallback, and 404 fragments', async () => {
    const base = await startDevServer()

    const home = await text(`${base}/`)
    expect(home.response.status).toBe(200)
    expect(home.body).toContain('<main data-route-root>')
    expect(home.body).toContain('<script src="/__snz/hmr.js"></script>')

    const componentsPage = await text(`${base}/components/index.html`)
    expect(componentsPage.response.status).toBe(200)
    expect(componentsPage.body).toContain('Accordion + FAQ')
    expect(componentsPage.body).toContain('<script src="/__snz/hmr.js"></script>')

    const componentsRouteFallback = await text(`${base}/components/`)
    expect(componentsRouteFallback.response.status).toBe(200)
    expect(componentsRouteFallback.body).toContain('<main data-route-root>')
    expect(componentsRouteFallback.body).toContain('<script src="/__snz/hmr.js"></script>')

    const componentsFragment = await text(`${base}/routes/components.html`)
    expect(componentsFragment.response.status).toBe(200)
    expect(componentsFragment.body).toContain('Accordion + FAQ')
    expect(componentsFragment.body).not.toContain('/__snz/hmr.js')

    const missingFragment = await text(`${base}/routes/not-real.html`)
    expect(missingFragment.response.status).toBe(404)

    const notFoundFragment = await text(`${base}/routes/404.html`)
    expect(notFoundFragment.response.status).toBe(200)
    expect(notFoundFragment.body).toContain('Not found')

    const fallback = await text(`${base}/not-real/`)
    expect(fallback.response.status).toBe(200)
    expect(fallback.body).toContain('<main data-route-root>')
    expect(fallback.body).toContain('<script src="/__snz/hmr.js"></script>')
  }, 40_000)
})
