import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { build } from '../../build/index'
import { createBuildContext } from '../../build/build-context'

export async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), 'sttc-browser-'))
  const repo = resolve(import.meta.dir, '../../..')
  async function write(path: string, content: string) {
    const target = join(root, 'src', path)
    await mkdir(resolve(target, '..'), { recursive: true })
    await writeFile(target, content)
  }
  try {
    for (const dir of ['images', 'videos', 'files', 'styles']) await mkdir(join(root, 'src', dir), { recursive: true })
    await write('site.json', JSON.stringify({ name: 'Browser fixture', url: 'https://example.com', description: 'Synthetic browser behavior fixture.', locale: 'en', scroll: 'lenis' }))
    await write('shell.html', `<!doctype html><html lang="en" data-scroll="{{scroll}}"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width"><link rel="icon" href="data:,">
<script src="/router.js" type="module"></script><script src="/assets/js/scroll.js" defer></script><script src="/assets/js/app.js" type="module"></script>
</head><body><Header /><main></main></body></html>`)
    await write('components/Header.html', `<header><button aria-controls="menu" aria-expanded="false">Menu</button><nav id="menu"><a href="/docs/">Docs</a><a href="#target">Jump</a></nav></header>
<script>el.dataset.mounts = String(Number(el.dataset.mounts || 0) + 1)</script>`)
    await write('components/Probe.html', `<article><button data-snz-track="Probe" data-snz-track-location="main">Track</button></article>
<script>el.dataset.mounts = String(Number(el.dataset.mounts || 0) + 1)</script>`)
    for (const [path, title] of [['index.html', 'Home'], ['docs.html', 'Docs']]) {
      await write(`pages/${path}`, `<section id="intro"><h1>${title}</h1><Probe /><a href="/">Home</a><a href="/docs/">Read docs</a><a href="#target">Go to target</a></section><section id="target"><h2>Target</h2></section>`)
    }
    await write('pages/404.html', '<section id="missing"><h1>Fixture not found</h1><a href="/">Home</a></section>')
    await write('app.ts', 'export {}\n')
    await write('styles.css', ':root{color-scheme:light}body{margin:0}#intro{min-height:150vh}#target{min-height:100vh}html.js header button[aria-expanded="false"]+nav{display:none}')
    for (const path of ['app/scroll.js', 'app/vendor/lenis.min.js', 'styles/lenis.css']) {
      await write(path, await readFile(join(repo, 'templates/default/src', path), 'utf8'))
    }
    await build({ context: createBuildContext({ rootDir: root }) })
    return { root, repo, remove: () => rm(root, { recursive: true, force: true }) }
  } catch (error) {
    await rm(root, { recursive: true, force: true })
    throw error
  }
}

export async function startPreview(root: string, repo: string) {
  const child = Bun.spawn([process.execPath, join(repo, 'framework/preview.ts')], {
    cwd: root, env: { ...Bun.env, PORT: '0', HOST: '127.0.0.1' }, stdout: 'pipe', stderr: 'inherit',
  })
  // Read the bound ephemeral port; no guessed port, sleep, or readiness polling.
  const reader = child.stdout.getReader()
  const timeout = setTimeout(() => child.kill(), 15_000)
  try {
    let output = ''
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) throw new Error(`Preview exited before readiness: ${output}`)
      output += new TextDecoder().decode(chunk.value)
      const url = output.match(/preview (http:\/\/[^\s]+)/)?.[1]
      if (url) {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Preview readiness HTTP ${response.status}`)
        return { url, stop: async () => { child.kill(); await child.exited } }
      }
    }
  } catch (error) {
    child.kill()
    await child.exited
    throw error
  } finally {
    clearTimeout(timeout)
    reader.releaseLock()
  }
}
