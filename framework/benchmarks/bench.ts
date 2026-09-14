#!/usr/bin/env bun

import { mkdir, readdir, rm, stat } from 'fs/promises'
import { cpus, release, totalmem } from 'os'
import { dirname, join, resolve } from 'path'

type Scenario = 'routes' | 'content' | 'media'
type Mode = 'clean' | 'warm' | 'route-edit'
type RunRecord = {
  schemaVersion: 1
  frameworkRoot: string
  scenario: Scenario
  mode: Mode
  scale: number
  iteration: number
  warmup: boolean
  wallMs: number
  cpuUserMs: number
  cpuSystemMs: number
  maxRssBytes: number
  outputFiles: number
  outputBytes: number
}

const repoRoot = resolve(import.meta.dir, '..', '..')
const stateRoot = join(repoRoot, '.snz', 'benchmarks')
const peers = ['@11ty/eleventy', 'astro', 'hugo', 'zola'] as const

function arg(name: string, fallback?: string) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function positiveInt(name: string, fallback: number) {
  const value = Number(arg(name, String(fallback)))
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`)
  return value
}

async function write(path: string, content: string | Uint8Array) {
  await mkdir(dirname(path), { recursive: true })
  await Bun.write(path, content)
}

const shell = `<!doctype html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- @snz-components-css -->
<script src="/router.js" type="module"></script><script src="/assets/js/app.js" type="module"></script>
</head><body><main></main></body></html>`

const card = `<!--
  @desc Deterministic benchmark component.
  @attr title! Visible title.
-->
<article><h2>{{title}}</h2><div>{{slot}}</div></article>
<style>article { contain: content; }</style>`

const section = `<!-- @desc Neutral benchmark section. -->\n<section>{{slot}}</section>`

function routeBody(index: number) {
  const cards = Array.from({ length: 8 }, (_, cardIndex) =>
    `<Card title="Card ${cardIndex + 1}"><p>Deterministic body ${index}-${cardIndex}.</p></Card>`,
  ).join('\n')
  const path = index === 0 ? '/' : `/page-${String(index).padStart(4, '0')}/`
  return `<head><SEO title="Page ${index}" description="Deterministic benchmark route ${index}." path="${path}" /></head>\n<h1>Page ${index}</h1>\n${cards}\n`
}

export async function createFixture(rootDir: string, scenario: Scenario, scale: number) {
  await rm(rootDir, { recursive: true, force: true })
  await write(join(rootDir, 'src/site.json'), JSON.stringify({
    name: 'SNZ benchmark',
    url: 'https://benchmark.invalid',
    description: 'Deterministic benchmark fixture for renderer performance.',
    locale: 'en',
  }, null, 2))
  await write(join(rootDir, 'src/shell.html'), shell)
  await write(join(rootDir, 'src/components/Card.html'), card)
  await write(join(rootDir, 'src/components/Section.html'), section)
  await write(join(rootDir, 'src/styles.css'), ':root{font-family:system-ui}\n')
  await write(join(rootDir, 'src/app.ts'), 'export {}\n')
  await write(join(rootDir, 'src/pages/index.html'), routeBody(0))
  await write(join(rootDir, 'src/pages/404.html'), '<head><SEO title="Not found" description="Deterministic benchmark 404 route." /></head>\n<h1>Not found</h1>\n')

  if (scenario === 'routes') {
    for (let index = 1; index < scale; index++) {
      await write(join(rootDir, 'src/pages', `page-${String(index).padStart(4, '0')}.html`), routeBody(index))
    }
  } else if (scenario === 'content') {
    await write(join(rootDir, 'src/templates/post.html'), '<article><h1>{{title}}</h1>{{body}}</article>\n')
    for (let index = 0; index < scale; index++) {
      const id = String(index).padStart(4, '0')
      await write(join(rootDir, 'content/posts', `post-${id}.md`), `---\ntitle: Post ${id}\ndate: 2025-01-01\ndescription: Deterministic content record ${id}.\ntags: [group-${index % 10}]\n---\n\nParagraph ${id}.\n`)
    }
  } else {
    for (let index = 0; index < scale; index++) {
      const bytes = new Uint8Array(32 * 1024).fill(index % 251)
      await write(join(rootDir, 'src/files', `asset-${String(index).padStart(4, '0')}.bin`), bytes)
    }
  }
}

async function inventory(root: string) {
  let files = 0
  let bytes = 0
  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) await walk(path)
      else if (entry.isFile()) { files++; bytes += (await stat(path)).size }
    }
  }
  await walk(root)
  return { files, bytes }
}

export async function validateFixture(rootDir: string, scenario: Scenario, scale: number) {
  const manifest = await Bun.file(join(rootDir, 'dist/site.manifest.json')).json() as { routes?: Array<{ slug: string }> }
  const slugs = (manifest.routes ?? []).map((route) => route.slug).sort()
  const expected = ['index']
  if (scenario === 'routes') {
    for (let index = 1; index < scale; index++) expected.push(`page-${String(index).padStart(4, '0')}`)
  } else if (scenario === 'content') {
    expected.push('insights', 'tags')
    for (let index = 0; index < Math.min(scale, 10); index++) expected.push(`tags/group-${index}`)
    for (let index = 0; index < scale; index++) expected.push(`insights/post-${String(index).padStart(4, '0')}`)
  }
  expected.sort()
  if (JSON.stringify(slugs) !== JSON.stringify(expected)) {
    throw new Error(`route manifest mismatch: expected ${expected.length}, found ${slugs.length}`)
  }

  const html = await Bun.file(join(rootDir, 'dist/index.html')).text()
  if (!/<h1[^>]*>Page 0<\/h1>/.test(html) || html.includes('{{')) throw new Error('invalid rendered index')

  for (const extension of ['json', 'md']) {
    const routeSlugs: string[] = []
    const routeGlob = new Bun.Glob(`**/*.${extension}`)
    for await (const rel of routeGlob.scan({ cwd: join(rootDir, 'dist', 'routes'), onlyFiles: true })) {
      routeSlugs.push(rel.replace(/\\/g, '/').replace(new RegExp(`\\.${extension}$`), ''))
    }
    routeSlugs.sort()
    if (JSON.stringify(routeSlugs) !== JSON.stringify(expected)) throw new Error(`route ${extension.toUpperCase()} inventory mismatch`)
  }

  const publicSlugs: string[] = ['index']
  const publicGlob = new Bun.Glob('**/index.html')
  for await (const rel of publicGlob.scan({ cwd: join(rootDir, 'dist'), onlyFiles: true })) {
    const normalized = rel.replace(/\\/g, '/')
    // The 404 page is public output but not a manifest route.
    if (normalized !== 'index.html' && normalized !== '404/index.html') {
      publicSlugs.push(normalized.replace(/\/index\.html$/, ''))
    }
  }
  publicSlugs.sort()
  if (JSON.stringify(publicSlugs) !== JSON.stringify(expected)) throw new Error('public route inventory mismatch')

  const publicPath = (slug: string) => slug === 'index'
    ? join(rootDir, 'dist', 'index.html')
    : join(rootDir, 'dist', slug, 'index.html')
  for (const slug of expected) {
    const jsonPath = join(rootDir, 'dist', 'routes', `${slug}.json`)
    const markdownPath = join(rootDir, 'dist', 'routes', `${slug}.md`)
    for (const path of [jsonPath, markdownPath, publicPath(slug)]) {
      if (!(await Bun.file(path).exists())) throw new Error(`missing route output ${path}`)
    }
  }

  if (scenario === 'routes') {
    for (let index = 0; index < scale; index++) {
      const slug = index === 0 ? 'index' : `page-${String(index).padStart(4, '0')}`
      const page = await Bun.file(publicPath(slug)).text()
      if (!new RegExp(`<h1[^>]*>Page ${index}</h1>`).test(page) || page.includes('{{')) throw new Error(`invalid route output ${slug}`)
    }
  }
  if (scenario === 'content') {
    for (let index = 0; index < scale; index++) {
      const id = String(index).padStart(4, '0')
      const page = await Bun.file(publicPath(`insights/post-${id}`)).text()
      if (!new RegExp(`<h1[^>]*>Post ${id}</h1>`).test(page) || page.includes('{{')) throw new Error(`invalid content output post-${id}`)
    }
    const feed = await Bun.file(join(rootDir, 'dist', 'feed.xml')).text()
    const last = String(scale - 1).padStart(4, '0')
    if (!feed.includes('Post 0000') || !feed.includes(`Post ${last}`)) throw new Error('incomplete content feed')
    if (!(await Bun.file(join(rootDir, 'dist', 'feed.json')).exists())) throw new Error('missing content feed.json')
  }
  if (scenario === 'media') {
    const mediaDir = join(rootDir, 'dist', 'assets', 'files')
    const expectedFiles = Array.from({ length: scale }, (_, index) => `asset-${String(index).padStart(4, '0')}.bin`)
    const actualFiles = (await readdir(mediaDir).catch(() => [])).sort()
    if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) throw new Error('media output inventory mismatch')
    for (let index = 0; index < scale; index++) {
      const rel = `assets/files/${expectedFiles[index]}`
      const bytes = new Uint8Array(await Bun.file(join(rootDir, 'dist', rel)).arrayBuffer())
      const expectedByte = index % 251
      if (bytes.length !== 32 * 1024 || bytes.some((byte) => byte !== expectedByte)) {
        throw new Error(`invalid media output ${rel}`)
      }
    }
  }
}

async function runOnce(frameworkRoot: string, rootDir: string, scenario: Scenario, mode: Mode, scale: number, iteration: number, warmup: boolean): Promise<RunRecord> {
  if (mode === 'clean') await rm(join(rootDir, 'dist'), { recursive: true, force: true })
  if (mode === 'route-edit') {
    await write(join(rootDir, 'src/pages/index.html'), `${routeBody(0)}\n<!-- benchmark edit ${String(iteration).padStart(8, '0')} -->\n`)
  }
  const started = performance.now()
  const proc = Bun.spawn(['bun', join(frameworkRoot, 'framework/build/index.ts')], {
    cwd: rootDir,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' },
  })
  const [, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  const wallMs = performance.now() - started
  if (exitCode !== 0) throw new Error(stderr || `build exited ${exitCode}`)
  await validateFixture(rootDir, scenario, scale)
  const usage = proc.resourceUsage()
  const output = await inventory(join(rootDir, 'dist'))
  return {
    schemaVersion: 1,
    frameworkRoot,
    scenario,
    mode,
    scale,
    iteration,
    warmup,
    wallMs,
    cpuUserMs: Number(usage?.cpuTime.user ?? 0) / 1000,
    cpuSystemMs: Number(usage?.cpuTime.system ?? 0) / 1000,
    maxRssBytes: Number(usage?.maxRSS ?? 0),
    outputFiles: output.files,
    outputBytes: output.bytes,
  }
}

function percentile(values: number[], ratio: number) {
  const sorted = [...values].sort((a, b) => a - b)
  const index = (sorted.length - 1) * ratio
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]!
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (index - lower)
}

async function frameworkDigest(frameworkRoot: string) {
  const glob = new Bun.Glob('framework/**/*.{ts,js}')
  const files: string[] = []
  for await (const rel of glob.scan({ cwd: frameworkRoot, onlyFiles: true })) files.push(rel.replace(/\\/g, '/'))
  files.sort()
  const hash = new Bun.CryptoHasher('sha256')
  for (const rel of files) {
    hash.update(`${rel}\0`)
    hash.update(new Uint8Array(await Bun.file(join(frameworkRoot, rel)).arrayBuffer()))
    hash.update('\n')
  }
  return hash.digest('hex')
}

function summary(values: number[]) {
  const median = percentile(values, 0.5)
  const deviations = values.map((value) => Math.abs(value - median))
  return {
    median,
    p25: percentile(values, 0.25),
    p75: percentile(values, 0.75),
    p95: percentile(values, 0.95),
    mad: percentile(deviations, 0.5),
  }
}

async function internal() {
  const frameworkRoot = resolve(arg('--framework-root', repoRoot)!)
  const scenario = (arg('--scenario', 'routes') ?? 'routes') as Scenario
  if (!['routes', 'content', 'media'].includes(scenario)) throw new Error(`unknown scenario ${scenario}`)
  const mode = (arg('--mode', 'clean') ?? 'clean') as Mode
  if (!['clean', 'warm', 'route-edit'].includes(mode)) throw new Error(`unknown mode ${mode}`)
  const scale = positiveInt('--scale', 100)
  const warmups = positiveInt('--warmups', 2)
  const samples = positiveInt('--samples', 5)
  const rootDir = join(stateRoot, 'work', `${scenario}-${scale}`)
  await createFixture(rootDir, scenario, scale)
  const records: RunRecord[] = []
  for (let iteration = 0; iteration < warmups + samples; iteration++) {
    records.push(await runOnce(frameworkRoot, rootDir, scenario, mode, scale, iteration, iteration < warmups))
  }
  const measured = records.filter((record) => !record.warmup)
  const resultPath = join(stateRoot, 'results', `${scenario}-${mode}-${scale}-${Date.now()}.json`)
  const environment = {
    bun: Bun.version,
    frameworkDigest: await frameworkDigest(frameworkRoot),
    platform: process.platform,
    arch: process.arch,
    osRelease: release(),
    cpu: cpus()[0]?.model ?? 'unknown',
    logicalCores: cpus().length,
    totalMemoryBytes: totalmem(),
    frameworkRoot,
  }
  await write(resultPath, `${JSON.stringify({ schemaVersion: 1, environment, records }, null, 2)}\n`)
  console.log(JSON.stringify({
    scenario,
    mode,
    scale,
    samples,
    wallMs: summary(measured.map((record) => record.wallMs)),
    cpuMs: summary(measured.map((record) => record.cpuUserMs + record.cpuSystemMs)),
    peakRssBytes: Math.max(...measured.map((record) => record.maxRssBytes)),
    outputFiles: measured[0]?.outputFiles,
    outputBytes: measured[0]?.outputBytes,
    resultPath,
  }, null, 2))
}

async function validate() {
  const rootDir = join(stateRoot, 'validate')
  await createFixture(rootDir, 'routes', 10)
  await runOnce(repoRoot, rootDir, 'routes', 'clean', 10, 0, true)
  console.log('benchmark validation ok')
}

function categoryDryRun() {
  console.log(JSON.stringify({
    status: 'dry-run-only',
    category: 'General-purpose static site generators with reusable composition and no mandatory hydration',
    peers,
    primaryScales: [10, 100, 1000],
    warmups: 5,
    samples: 30,
    claimGate: 'Fastest in every claimed cell and bootstrap 95% CI for SNZ / next-best below 0.95 on Linux x64 and arm64',
    note: 'Peer installation and measured category runs require separate approval.',
  }, null, 2))
}

if (import.meta.main) {
  const command = process.argv[2] ?? 'validate'
  if (command === 'validate') await validate()
  else if (command === 'internal') await internal()
  else if (command === 'category' && process.argv.includes('--dry-run')) categoryDryRun()
  else throw new Error('Usage: bun framework/benchmarks/bench.ts <validate|internal|category --dry-run>')
}
