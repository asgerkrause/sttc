// Strict validation. Runs at the end of `bun run build` automatically (skippable with
// --allow-broken-links). Also runnable as `bun run check` for an out-of-band scan.

import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'
import { componentsDir, dist, root, src } from './paths'
import { BuildError } from './errors'

export type CheckReport = { errors: string[]; warnings: string[] }

export async function runChecks(opts: { allowBrokenLinks?: boolean } = {}): Promise<CheckReport> {
  const errors: string[] = []
  const warnings: string[] = []
  const fail = (m: string) => errors.push(m)
  const warn = (m: string) => warnings.push(m)

  await checkSiteJson(fail)
  await checkSeoFiles(fail)
  await checkJsonLd(fail)
  if (!opts.allowBrokenLinks) await checkInternalLinks(fail)
  await checkComponentTags(warn)
  await checkDiscoveryArtifacts(fail)

  return { errors, warnings }
}

async function collectHtmlFiles(dir: string, base = ''): Promise<string[]> {
  const out: string[] = []
  let entries
  try { entries = await readdir(join(dir, base), { withFileTypes: true }) } catch { return out }
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...(await collectHtmlFiles(dir, rel)))
    else if (entry.name.endsWith('.html')) out.push(join(dir, rel))
  }
  return out
}

function extractLdJson(html: string) {
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  const blocks: string[] = []
  for (const m of html.matchAll(re)) blocks.push(m[1].trim())
  return blocks
}

async function checkJsonLd(fail: (m: string) => void) {
  const files = [join(dist, 'index.html'), ...(await collectHtmlFiles(join(dist, 'routes')))]
  for (const file of files) {
    let html: string
    try { html = await readFile(file, 'utf8') } catch { fail(`missing ${file}`); continue }
    const blocks = extractLdJson(html)
    if (blocks.length === 0) { fail(`${file}: no application/ld+json`); continue }
    for (const raw of blocks) {
      try {
        const data = JSON.parse(raw)
        if (!data['@context']) fail(`${file}: JSON-LD missing @context`)
      } catch {
        fail(`${file}: invalid JSON-LD`)
      }
    }
  }
}

async function checkSeoFiles(fail: (m: string) => void) {
  const robots = await readFile(join(dist, 'robots.txt'), 'utf8').catch(() => null)
  if (!robots) fail('missing dist/robots.txt')
  else if (!robots.includes('Sitemap:')) fail('robots.txt missing Sitemap line')

  const sitemap = await readFile(join(dist, 'sitemap.xml'), 'utf8').catch(() => null)
  if (!sitemap) fail('missing dist/sitemap.xml')
  else if (!sitemap.includes('<urlset')) fail('sitemap.xml invalid')
}

async function routeExists(href: string) {
  const path = href.replace(/\/$/, '') || '/'
  if (path === '/') return stat(join(dist, 'index.html')).then(() => true).catch(() => false)
  const slug = path.slice(1)
  return stat(join(dist, 'routes', `${slug}.html`)).then(() => true).catch(() => false)
}

async function assetExists(href: string) {
  const rel = href.startsWith('/') ? href.slice(1) : href
  return stat(join(dist, rel)).then(() => true).catch(() => false)
}

async function checkInternalLinks(fail: (m: string) => void) {
  const htmlFiles = [join(dist, 'index.html'), ...(await collectHtmlFiles(join(dist, 'routes')))]
  const hrefRe = /href="(\/[^"#?]*)"/g
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8')
    for (const m of html.matchAll(hrefRe)) {
      const href = m[1]
      if (href.startsWith('/assets/') || href.startsWith('/media/') || href.startsWith('/lib/')) {
        if (!(await assetExists(href))) fail(`${file}: broken asset ${href}`)
      } else if (href.endsWith('.html') || href.endsWith('.json') || href.endsWith('.txt')) {
        if (!(await assetExists(href))) fail(`${file}: broken link ${href}`)
      } else {
        if (!(await routeExists(href))) fail(`${file}: broken route ${href}`)
      }
    }
  }
}

async function checkSiteJson(fail: (m: string) => void) {
  try { JSON.parse(await readFile(join(src, 'site.json'), 'utf8')) }
  catch { fail('src/site.json is not valid JSON') }
}

async function checkComponentTags(warn: (m: string) => void) {
  let names: string[]
  try {
    names = (await readdir(componentsDir)).filter((n) => n.endsWith('.html')).map((n) => n.replace(/\.html$/, ''))
  } catch { return }
  const known = new Set(names)
  const tagRe = /<([A-Z][A-Za-z0-9]*)(?:\s|\/|>)/g
  async function scanFile(path: string) {
    const html = await readFile(path, 'utf8').catch(() => null)
    if (!html) return
    for (const m of html.matchAll(tagRe)) {
      if (known.has(m[1])) continue
      warn(`${path}: unknown component <${m[1]} />`)
    }
  }
  await scanFile(join(src, 'shell.html'))
  for (const name of await readdir(join(src, 'routes')).catch(() => [])) {
    if (name.endsWith('.html')) await scanFile(join(src, 'routes', name))
  }
}

async function checkDiscoveryArtifacts(fail: (m: string) => void) {
  const required = [
    'llms.txt',
    'llms-full.txt',
    'site.manifest.json',
    '.well-known/ai-plugin.json',
  ]
  for (const rel of required) {
    if (!(await assetExists(`/${rel}`))) fail(`missing dist/${rel}`)
  }
  try {
    const manifest = JSON.parse(await readFile(join(dist, 'site.manifest.json'), 'utf8'))
    if (!Array.isArray(manifest.routes) || !manifest.routes.length) fail('site.manifest.json: routes array empty or missing')
    if (!Array.isArray(manifest.components)) fail('site.manifest.json: components array missing')
  } catch {
    fail('site.manifest.json: invalid JSON')
  }
}

// CLI entry — `bun run check`
if (import.meta.main) {
  const skipBuild = process.argv.includes('--skip-build')
  if (!skipBuild) {
    const proc = Bun.spawn(['bun', 'run', 'build'], { cwd: root, stdout: 'inherit', stderr: 'inherit' })
    const code = await proc.exited
    if (code !== 0) process.exit(code)
  }
  const allowBrokenLinks = process.argv.includes('--allow-broken-links')
  const report = await runChecks({ allowBrokenLinks })
  for (const w of report.warnings) console.warn(`warn: ${w}`)
  if (report.errors.length) {
    for (const e of report.errors) console.error(`error: ${e}`)
    process.exit(1)
  }
  console.log('check ok')
}

// Used by the build pipeline as the final step.
export async function failOnReport(report: CheckReport, throwOnError = true) {
  for (const w of report.warnings) console.warn(`warn: ${w}`)
  if (report.errors.length && throwOnError) {
    throw new BuildError(
      `Strict checks failed (${report.errors.length}):\n  - ${report.errors.join('\n  - ')}`,
      { hint: 'Fix the listed issues, or pass --allow-broken-links to bypass during dev.' },
    )
  }
}
