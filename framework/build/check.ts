// Strict validation. Runs at the end of `bun run build` automatically (skippable with
// --allow-broken-links). Also runnable as `bun run check` for an out-of-band scan.

import { readdir, readFile, stat } from 'fs/promises'
import { basename, join } from 'path'
import { componentsDir, dist, legacyAppDir, legacyImagesDir, legacyRuntimeLib, legacyRuntimeRouter, legacyStylesDir, packageRoot, pagesDir, root, routesDir, shellFile, src } from './paths'
import { discoverSourceRoutes } from './source-files'
import { BuildError, lineOf } from './errors'
import { compileContent, loadCustomContentCollections } from './content'
import { assertUniqueImageNames, imageSourceRoots, parsePagesCmsMediaInputs, parsePagesCmsMediaOutputs } from './images'

export type CheckReport = { errors: string[]; warnings: string[] }

type CheckOptions = { allowBrokenLinks?: boolean; launch?: boolean }

export async function runChecks(opts: CheckOptions = {}): Promise<CheckReport> {
  const errors: string[] = []
  const warnings: string[] = []
  const fail = (m: string) => errors.push(m)
  const warn = (m: string) => warnings.push(m)

  await checkSiteJson(fail)
  await checkSourceContracts(fail, warn)
  await checkSourceLayout(warn)
  await checkSeoFiles(fail)
  await checkJsonLd(fail)
  await checkBuiltPublicAssetRefs(dist, fail)
  if (!opts.allowBrokenLinks) await checkInternalLinks(fail)
  await checkComponentTags(warn)
  await checkDiscoveryArtifacts(fail)
  if (opts.launch) await checkLaunchReadiness(fail, warn)

  return { errors, warnings }
}

async function collectFilesByExtension(dir: string, extension: string, base = ''): Promise<string[]> {
  const out: string[] = []
  let entries
  try { entries = await readdir(join(dir, base), { withFileTypes: true }) } catch { return out }
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...(await collectFilesByExtension(dir, extension, rel)))
    else if (entry.name.endsWith(extension)) out.push(join(dir, rel))
  }
  return out
}

async function collectHtmlFiles(dir: string, base = ''): Promise<string[]> {
  return collectFilesByExtension(dir, '.html', base)
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

const PUBLIC_ASSET_RE = /\/assets\/(images|videos|files)\/[^"'`\s<>)\\]+/g

function cleanAssetRef(ref: string) {
  return ref.replace(/[.,;:]+$/g, '').replace(/[?#].*$/, '')
}

export function extractBuiltPublicAssetRefs(text: string) {
  const refs = new Set<string>()
  for (const match of text.matchAll(PUBLIC_ASSET_RE)) {
    const ref = cleanAssetRef(match[0])
    if (ref.includes('{') || ref.includes('}')) continue
    refs.add(ref)
  }
  return [...refs].sort()
}

export function extractBuiltImageRefs(text: string) {
  return extractBuiltPublicAssetRefs(text).filter((ref) => ref.startsWith('/assets/images/'))
}

async function builtAssetExists(distRoot: string, ref: string) {
  const rel = ref.startsWith('/') ? ref.slice(1) : ref
  return stat(join(distRoot, rel)).then(() => true).catch(() => false)
}

function missingPublicAssetHint(ref: string) {
  if (ref.startsWith('/assets/images/')) {
    const name = basename(ref).replace(/\.webp$/i, '')
    return `Add an image master named ${name}.{jpg,png,webp} in src/images or PagesCMS media.input, then rebuild. CMS /src/images/* refs publish as /assets/images/*.webp.`
  }
  if (ref.startsWith('/assets/videos/')) return 'Add the public video source file under src/videos, then rebuild.'
  if (ref.startsWith('/assets/files/')) return 'Add the public file under src/files, then rebuild.'
  return 'Add the public source file, then rebuild.'
}

export async function checkBuiltPublicAssetRefs(distRoot: string, fail: (m: string) => void) {
  const files = [
    join(distRoot, 'index.html'),
    ...(await collectHtmlFiles(join(distRoot, 'routes'))),
    ...(await collectFilesByExtension(distRoot, '.json')),
    ...(await collectFilesByExtension(join(distRoot, 'assets'), '.css')),
    ...(await collectFilesByExtension(join(distRoot, 'assets'), '.js')),
  ]
  const seen = new Set<string>()

  for (const file of files) {
    if (seen.has(file)) continue
    seen.add(file)
    const text = await readFile(file, 'utf8').catch(() => null)
    if (!text) continue
    for (const ref of extractBuiltPublicAssetRefs(text)) {
      if (await builtAssetExists(distRoot, ref)) continue
      fail(`${file}: missing public asset ${ref}\n  hint: ${missingPublicAssetHint(ref)}`)
    }
  }
}

export async function checkBuiltImageRefs(distRoot: string, fail: (m: string) => void) {
  await checkBuiltPublicAssetRefs(distRoot, fail)
}

async function checkInternalLinks(fail: (m: string) => void) {
  const htmlFiles = [join(dist, 'index.html'), ...(await collectHtmlFiles(join(dist, 'routes')))]
  const hrefRe = /href="(\/[^"#?]*)"/g
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8').catch(() => null)
    if (!html) { fail(`missing ${file}`); continue }
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

async function checkSourceContracts(fail: (m: string) => void, warn: (m: string) => void) {
  await checkVercelConfig(root, warn)

  const imageRoots = await imageSourceRoots(root).catch((err) => {
    if (err instanceof BuildError) {
      fail(err.hint ? `${err.message}\n  hint: ${err.hint}` : err.message)
      return []
    }
    fail(err instanceof Error ? err.message : String(err))
    return []
  })
  await assertUniqueImageNames(...imageRoots).catch((err) => {
    if (err instanceof BuildError) {
      fail(err.hint ? `${err.message}\n  hint: ${err.hint}` : err.message)
      return
    }
    fail(err instanceof Error ? err.message : String(err))
  })

  const routeSlugs = new Map<string, string>()
  for (const route of await discoverSourceRoutes()) {
    routeSlugs.set(route.slug, route.sourceRel)
  }

  const contentRoutes = await compileContent().catch((err) => {
    fail(err instanceof Error ? err.message : String(err))
    return []
  })
  for (const route of contentRoutes) {
    const existing = routeSlugs.get(route.slug)
    if (existing) fail(`${route.source}: content route collides with ${existing} at /${route.slug}/`)
  }

  for (const template of ['post.html']) {
    const rel = `src/templates/${template}`
    const raw = await readFile(join(src, 'templates', template), 'utf8').catch(() => '')
    if (!raw) continue
    if (!raw.includes('{{body}}')) fail(`${rel}: missing {{body}} placeholder`)
    if (!raw.includes('{{title}}')) warn(`${rel}: missing {{title}} placeholder`)
  }

  const customCollections = await loadCustomContentCollections().catch((err) => {
    fail(err instanceof Error ? err.message : String(err))
    return []
  })
  for (const collection of customCollections) {
    const rel = `src/templates/${collection.template}`
    const raw = await readFile(join(src, 'templates', collection.template), 'utf8').catch(() => '')
    if (!raw) {
      fail(`${rel}: missing custom collection template for "${collection.name}"`)
      continue
    }
    if (!raw.includes('{{body}}')) fail(`${rel}: missing {{body}} placeholder`)
    if (!raw.includes('{{title}}')) warn(`${rel}: missing {{title}} placeholder`)
  }

  const pages = await readFile(join(root, '.pages.yml'), 'utf8').catch(() => '')
  if (pages) {
    try {
      checkPagesCmsConfig(pages, warn)
    } catch (err) {
      if (err instanceof BuildError) fail(err.hint ? `${err.message}\n  hint: ${err.hint}` : err.message)
      else fail(err instanceof Error ? err.message : String(err))
    }
  }

  await checkComponentActiveScripts(warn)
}

const COMPONENT_SCRIPT_RE = /<script(?![^>]*type=["']application\/ld\+json["'])(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi

function hasRecursiveRaf(code: string) {
  for (const match of code.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*{[\s\S]*?requestAnimationFrame\(\s*\1\s*\)/g)) {
    if (match[1]) return true
  }
  return false
}

function activeScriptNeedsGuard(code: string) {
  if (/snz\?\.on(?:Active|Visible)|snz\.on(?:Active|Visible)|window\.snz\?\.on(?:Active|Visible)|window\.snz\.on(?:Active|Visible)/.test(code)) return false
  if (/new\s+IntersectionObserver\b/.test(code)) return false
  return hasRecursiveRaf(code)
    || /\bsetInterval\s*\(/.test(code)
    || /\.play\s*\(/.test(code)
    || /addEventListener\(\s*['"]scroll['"]/.test(code)
}

async function checkComponentActiveScripts(warn: (m: string) => void) {
  let entries: string[]
  try { entries = await readdir(componentsDir) } catch { return }
  for (const file of entries.filter((entry) => entry.endsWith('.html')).sort()) {
    const rel = `src/components/${file}`
    const raw = await readFile(join(componentsDir, file), 'utf8').catch(() => '')
    for (const match of raw.matchAll(COMPONENT_SCRIPT_RE)) {
      const code = match[1] ?? ''
      if (activeScriptNeedsGuard(code)) warn(`${rel}: component script appears to run active work without snz.onActive/onVisible`)
    }
  }
}

export function checkPagesCmsConfig(pages: string, warn: (m: string) => void) {
  if (parsePagesCmsMediaInputs(pages).length === 0) {
    warn('.pages.yml: media.input missing; build defaults CMS image input to src/images')
  }

  const outputs = parsePagesCmsMediaOutputs(pages)
  if (outputs.length === 0) {
    warn('.pages.yml: media.output missing; set it to /assets/images so editor previews match optimized build output')
    return
  }

  for (const output of outputs) {
    if (output !== '/assets/images') warn(`.pages.yml: media.output "${output}" should be /assets/images because CMS images publish as optimized assets`)
  }
}

type VercelHeader = {
  key?: unknown
  value?: unknown
}

type VercelHeaderRule = {
  source?: unknown
  headers?: unknown
}

type VercelConfig = {
  framework?: unknown
  installCommand?: unknown
  buildCommand?: unknown
  devCommand?: unknown
  outputDirectory?: unknown
  bunVersion?: unknown
  cleanUrls?: unknown
  trailingSlash?: unknown
  headers?: unknown
}

function hasCacheHeader(rule: VercelHeaderRule, source: string, valueIncludes: string) {
  if (rule.source !== source || !Array.isArray(rule.headers)) return false
  return rule.headers.some((header: VercelHeader) => (
    header?.key === 'Cache-Control'
    && typeof header.value === 'string'
    && header.value.includes(valueIncludes)
  ))
}

export async function checkVercelConfig(projectRoot: string, warn: (m: string) => void) {
  const rel = 'vercel.json'
  const path = join(projectRoot, rel)
  const raw = await readFile(path, 'utf8').catch(() => null)
  if (!raw) return

  let config: VercelConfig
  try {
    config = JSON.parse(raw)
  } catch {
    warn(`${rel}: invalid JSON; Vercel deploys may ignore framework defaults`)
    return
  }

  const expected: [keyof VercelConfig, unknown, string][] = [
    ['framework', null, 'null'],
    ['installCommand', 'bun install', '"bun install"'],
    ['buildCommand', 'bun run build', '"bun run build"'],
    ['devCommand', 'bun run dev', '"bun run dev"'],
    ['outputDirectory', 'dist', '"dist"'],
    ['bunVersion', '1.x', '"1.x"'],
    ['cleanUrls', true, 'true'],
    ['trailingSlash', true, 'true'],
  ]
  for (const [key, value, label] of expected) {
    if (config[key] !== value) warn(`${rel}: ${key} should be ${label} for snz-bp Bun static deploys`)
  }

  const headers = Array.isArray(config.headers) ? config.headers as VercelHeaderRule[] : []
  if (!hasCacheHeader(headers.find((rule) => rule.source === '/assets/(.*)') ?? {}, '/assets/(.*)', 'immutable')) {
    warn(`${rel}: /assets/(.*) should use immutable Cache-Control headers`)
  }
  if (!headers.some((rule) => (
    typeof rule.source === 'string'
    && rule.source.includes('llms')
    && rule.source.includes('robots')
    && rule.source.includes('sitemap')
    && hasCacheHeader(rule, rule.source, 'max-age=3600')
  ))) {
    warn(`${rel}: discovery files should use short Cache-Control headers`)
  }
}

async function checkSourceLayout(warn: (m: string) => void) {
  const legacy = [
    ['src/routes', routesDir],
    ['src/styles/styles.css', join(src, 'styles', 'styles.css')],
    ['src/app/app.js', join(src, 'app', 'app.js')],
    ['src/assets/js', legacyAppDir],
    ['src/assets/css', legacyStylesDir],
    ['src/assets/images', legacyImagesDir],
    ['router.js', legacyRuntimeRouter],
    ['lib', legacyRuntimeLib],
  ] as const
  for (const [label, path] of legacy) {
    try {
      await stat(path)
      warn(`${label} is legacy; prefer src/pages, src/styles.css, src/app.ts, src/images, src/videos, src/files, or runtime instead`)
    } catch {
      /* canonical layout */
    }
  }
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
  await scanFile(shellFile)
  const glob = new Bun.Glob('**/*.html')
  for (const dir of [routesDir, pagesDir]) {
    if (!(await Bun.file(dir).exists())) continue
    for await (const rel of glob.scan({ cwd: dir, onlyFiles: true })) {
      await scanFile(join(dir, rel))
    }
  }
}

function htmlText(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

function attrValue(attrs: string, name: string) {
  const re = new RegExp(`\\s${name}=("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
  const m = attrs.match(re)
  return m ? (m[2] ?? m[3] ?? m[4] ?? '') : undefined
}

function prettyFileLine(file: string, html: string, index: number) {
  return `${file}:${lineOf(html, index)}`
}

function weakDescription(description: string) {
  const text = description.trim()
  return !text || text.length < 50 || /^(\.\.\.|todo|tbd|description|home page\.?|page\.?|coming soon\.?)$/i.test(text)
}

async function checkRouteSemantics(file: string, fail: (m: string) => void, warn: (m: string) => void) {
  const html = await readFile(file, 'utf8').catch(() => '')
  if (!html) return

  const titleMatches = [...html.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)]
  const titles = titleMatches.map((m) => htmlText(m[1]))
  if (titles.length === 0 || !titles[0]) fail(`${file}: missing page title\n  hint: Add <SEO title="Meaningful title" description="..." /> to the route head.`)
  if (titles.length > 1) fail(`${file}: multiple page titles\n  hint: Keep one <SEO /> entry per route.`)

  const descMatches = [...html.matchAll(/<meta\s+[^>]*name=["']description["'][^>]*>/gi)]
  const descriptions = descMatches.map((m) => attrValue(m[0], 'content') ?? '')
  if (descriptions.length === 0) fail(`${file}: missing meta description\n  hint: Add <SEO description="Specific 50–160 character summary" />.`)
  if (descriptions.length > 1) fail(`${file}: multiple meta descriptions\n  hint: Keep one route description.`)
  if (descriptions[0] !== undefined && weakDescription(descriptions[0])) warn(`${file}: weak meta description\n  hint: Use a specific 50–160 character summary; do not ship placeholders.`)

  const h1Matches = [...html.matchAll(/<h1\b[^>]*>/gi)]
  if (h1Matches.length === 0) fail(`${file}: missing H1\n  hint: Add one visible <h1> that names the page.`)
  if (h1Matches.length > 1) fail(`${file}: multiple H1s\n  hint: Keep one primary <h1>; demote section headings to <h2>.`)

  for (const m of html.matchAll(/<img\b([^>]*)>/gi)) {
    const attrs = m[1]
    const alt = attrValue(attrs, 'alt')
    if (alt === undefined) fail(`${prettyFileLine(file, html, m.index)}: image missing alt\n  hint: Add descriptive alt text, or alt="" for decorative images.`)
  }

  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = m[1]
    const text = htmlText(m[2]).toLowerCase()
    const aria = attrValue(attrs, 'aria-label')?.trim()
    const title = attrValue(attrs, 'title')?.trim()
    const accessible = aria || text || title
    if (!accessible) fail(`${prettyFileLine(file, html, m.index)}: link has no accessible name\n  hint: Add visible text or aria-label for icon-only links.`)
    if (/^(click here|read more|learn more|more|here)$/i.test(text) && !aria) warn(`${prettyFileLine(file, html, m.index)}: vague link text "${text}"\n  hint: Make link text specific, or add aria-label with context.`)
  }
}

async function checkLaunchSiteConfig(fail: (m: string) => void) {
  const rel = 'src/site.json'
  const raw = await readFile(join(src, 'site.json'), 'utf8').catch(() => '')
  let site: Record<string, unknown>
  try { site = JSON.parse(raw) } catch { return }
  const url = typeof site.url === 'string' ? site.url : ''
  if (!/^https:\/\/[^\s/$.?#].[^\s]*$/i.test(url) || /localhost|127\.0\.0\.1|0\.0\.0\.0|\.local\b|example\.com/i.test(url)) {
    fail(`${rel}: launch site.url must be a public https URL\n  hint: Set site.url to the production origin before launch.`)
  }
  const og = typeof site.ogImage === 'string' ? site.ogImage : ''
  if (!og) fail(`${rel}: launch ogImage missing\n  hint: Set ogImage to a real social preview image path.`)
}

async function checkPrivateOutputUrls(fail: (m: string) => void) {
  const files = [join(dist, 'index.html'), ...(await collectHtmlFiles(join(dist, 'routes'))), ...(await collectFilesByExtension(dist, '.json'))]
  const privateUrl = /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|[^\s"'<>]+\.local\b)/i
  for (const file of files) {
    const text = await readFile(file, 'utf8').catch(() => '')
    const m = text.match(privateUrl)
    if (m?.index !== undefined) fail(`${prettyFileLine(file, text, m.index)}: private URL in output\n  hint: Replace localhost/private URLs with production URLs before launch.`)
  }
}

async function checkDraftLeakage(fail: (m: string) => void) {
  const content = await compileContent().catch(() => [])
  for (const route of content) {
    if (route.draft) fail(`${route.source}: draft content included in production build\n  hint: Draft content must not emit during launch checks.`)
  }
}

async function checkLaunchReadiness(fail: (m: string) => void, warn: (m: string) => void) {
  await checkLaunchSiteConfig(fail)
  const routeFiles = (await collectHtmlFiles(join(dist, 'routes'))).filter((file) => file !== join(dist, 'routes', 'index.html'))
  const files = [join(dist, 'index.html'), ...routeFiles]
  const titleOwners = new Map<string, string>()
  const descOwners = new Map<string, string>()
  for (const file of files) {
    await checkRouteSemantics(file, fail, warn)
    const html = await readFile(file, 'utf8').catch(() => '')
    const title = htmlText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
    const descTag = html.match(/<meta\s+[^>]*name=["']description["'][^>]*>/i)?.[0] ?? ''
    const desc = attrValue(descTag, 'content') ?? ''
    if (title) {
      const existing = titleOwners.get(title)
      if (existing && title !== 'Not found') fail(`${file}: duplicate page title also used by ${existing}\n  hint: Give each launch route a unique title.`)
      else titleOwners.set(title, file)
    }
    if (desc) {
      const existing = descOwners.get(desc)
      if (existing) warn(`${file}: duplicate meta description also used by ${existing}\n  hint: Give each launch route a route-specific description.`)
      else descOwners.set(desc, file)
    }
  }
  await checkPrivateOutputUrls(fail)
  await checkDraftLeakage(fail)
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
    const proc = Bun.spawn(['bun', join(packageRoot, 'build', 'index.ts')], { cwd: root, stdout: 'inherit', stderr: 'inherit' })
    const code = await proc.exited
    if (code !== 0) process.exit(code)
  }
  const allowBrokenLinks = process.argv.includes('--allow-broken-links')
  const launch = process.argv.includes('--launch')
  const report = await runChecks({ allowBrokenLinks, launch })
  for (const w of report.warnings) console.warn(`warn: ${w}`)
  if (report.errors.length) {
    for (const e of report.errors) console.error(`error: ${e}`)
    process.exit(1)
  }
  console.log(launch ? 'launch check ok' : 'check ok')
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
