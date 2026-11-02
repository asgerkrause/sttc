// Strict validation. Runs at the end of `bun run build` automatically (skippable with
// --allow-broken-links). Also runnable as `bun run check` for an out-of-band scan.

import { readdir, readFile, stat } from 'fs/promises'
import { basename, join, sep } from 'path'
import { packageRoot, root } from './paths'
import { discoverSourceRoutes } from './source-files'
import { BuildError, lineOf } from './errors'
import { compileContentFrom, loadCustomContentCollections } from './content'
import { assertUniqueImageNames, imageSourceRoots, parsePagesCmsMediaInputs, parsePagesCmsMediaOutputs, sourceOgImagePath } from './images'
import { createBuildContext, type BuildContext } from './build-context'
import { loadSiteConfig } from './site-config'
import { IO_CONCURRENCY, mapConcurrent } from './concurrency'
import { INLINE_SCRIPT_RE } from './extract-js'

export type CheckReport = { errors: string[]; warnings: string[] }

type CheckOptions = { allowBrokenLinks?: boolean; launch?: boolean; context?: BuildContext; validatedBuildInputs?: boolean }

export async function runChecks(opts: CheckOptions = {}): Promise<CheckReport> {
  const context = opts.context ?? createBuildContext()
  const errors: string[] = []
  const warnings: string[] = []
  const fail = (m: string) => errors.push(m)
  const warn = (m: string) => warnings.push(m)

  await checkSiteJson(context.srcDir, fail)
  await checkSourceContracts(context, fail, warn, !!opts.validatedBuildInputs)
  await checkSeoFiles(context.distDir, fail)
  await checkBuiltOutput(context.distDir, fail, !!opts.allowBrokenLinks)
  await checkEmitContracts(context.distDir, context.srcDir, fail, opts.launch ? warn : () => {})
  await checkDiscoveryArtifacts(context.distDir, fail)
  if (opts.launch) await checkLaunchReadiness(context, fail, warn)

  return { errors, warnings }
}

async function collectFilesByExtension(dir: string, extension: string): Promise<string[]> {
  try {
    if (!(await stat(dir)).isDirectory()) return []
  } catch {
    return []
  }
  const out: string[] = []
  const glob = new Bun.Glob(`**/*${extension}`)
  for await (const rel of glob.scan({ cwd: dir, onlyFiles: true })) {
    out.push(join(dir, rel))
  }
  return out
}

async function collectHtmlFiles(dir: string): Promise<string[]> {
  return collectFilesByExtension(dir, '.html')
}

function isComposedPublicPage(distDir: string, file: string) {
  const rel = file.slice(distDir.length).replace(/\\/g, '/').replace(/^\//, '')
  if (rel === 'index.html' || rel.startsWith('assets/')) return false
  return rel.endsWith('/index.html')
}

/** dist/index.html plus every composed `{slug}/index.html`; raw public HTML under assets/ is excluded. */
async function collectPublicPages(distDir: string) {
  const index = join(distDir, 'index.html')
  return (await collectHtmlFiles(distDir)).filter((file) => file === index || isComposedPublicPage(distDir, file)).sort()
}

function extractLdJson(html: string) {
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  const blocks: string[] = []
  for (const m of html.matchAll(re)) blocks.push(m[1].trim())
  return blocks
}

async function checkSeoFiles(distDir: string, fail: (m: string) => void) {
  const robots = await readFile(join(distDir, 'robots.txt'), 'utf8').catch(() => null)
  if (!robots) fail('missing dist/robots.txt')
  else if (!robots.includes('Sitemap:')) fail('robots.txt missing Sitemap line')

  const sitemap = await readFile(join(distDir, 'sitemap.xml'), 'utf8').catch(() => null)
  if (!sitemap) fail('missing dist/sitemap.xml')
  else if (!sitemap.includes('<urlset')) fail('sitemap.xml invalid')
}

async function routeExists(distDir: string, href: string) {
  return assetExists(distDir, `${href.replace(/\/$/, '')}/index.html`)
}

// Refs are percent-encoded (my%20doc.pdf); files on disk keep their spaces.
function decodeRef(ref: string) {
  try { return decodeURIComponent(ref) } catch { return ref }
}

async function assetExists(distDir: string, href: string) {
  const rel = decodeRef(href.endsWith('/') ? `${href}index.html` : href).replace(/^\//, '')
  return stat(join(distDir, rel)).then(() => true).catch(() => false)
}

const PUBLIC_ASSET_RE = /\/assets\/(images|videos|files)\/[^"'`\s<>)\\]+/g

function cleanAssetRef(ref: string) {
  return ref.replace(/[.,;:]+$/g, '').replace(/[?#].*$/, '')
}

export async function checkBuiltOutput(distDir: string, fail: (m: string) => void, allowBrokenLinks: boolean) {
  const routeHtmlFiles = await collectPublicPages(distDir)
  const routeHtmlSet = new Set(routeHtmlFiles)
  if (!(await assetExists(distDir, '/404.html'))) {
    fail('missing dist/404.html\n  hint: Add src/pages/404.html. Hosts serve dist/404.html for unmatched paths.')
  }

  const assetOwners = new Map<string, string>()
  const linkOwners = new Map<string, string>()
  const rememberAssets = (file: string, text: string) => {
    for (const ref of extractBuiltPublicAssetRefs(text)) {
      if (!assetOwners.has(ref)) assetOwners.set(ref, file)
    }
  }

  const placeholderErrors = (file: string, html: string) => {
    const errors: string[] = []
    for (const match of html.matchAll(/\{\{[\w.-]+(?::[\w.-]+)?\}\}/g)) {
      errors.push(`${file}:${lineOf(html, match.index ?? 0)}: unresolved template placeholder "${match[0]}"\n  hint: Set a default in the composer, pass the attr, or let optional attrs/classes be pruned by the renderer.`)
    }
    return errors
  }

  const routeResults = await mapConcurrent(routeHtmlFiles, IO_CONCURRENCY, async (file) => {
    const errors: string[] = []
    const html = await readFile(file, 'utf8').catch(() => null)
    if (!html) return { file, errors: [`missing ${file}`], html: null }
    const blocks = extractLdJson(html)
    if (blocks.length === 0) errors.push(`${file}: no application/ld+json`)
    for (const raw of blocks) {
      try {
        const data = JSON.parse(raw)
        if (!data['@context']) errors.push(`${file}: JSON-LD missing @context`)
      } catch {
        errors.push(`${file}: invalid JSON-LD`)
      }
    }
    errors.push(...placeholderErrors(file, html))
    return { file, errors, html }
  })

  for (const result of routeResults) {
    for (const error of result.errors) fail(error)
    if (!result.html) continue
    rememberAssets(result.file, result.html)
    if (!allowBrokenLinks) {
      for (const match of result.html.matchAll(/href="(\/[^"#?]*)"/g)) {
        if (!linkOwners.has(match[1])) linkOwners.set(match[1], result.file)
      }
    }
  }

  // Other HTML (raw public files, the root 404.html copy) is scanned for unresolved placeholders only.
  const extraHtml = (await collectHtmlFiles(distDir)).filter((file) => !routeHtmlSet.has(file)).sort()
  const extraResults = await mapConcurrent(extraHtml, IO_CONCURRENCY, async (file) => {
    const html = await readFile(file, 'utf8').catch(() => null)
    return html ? placeholderErrors(file, html) : []
  })
  for (const errors of extraResults) {
    for (const error of errors) fail(error)
  }

  const otherFiles = [
    ...(await collectFilesByExtension(distDir, '.json')),
    ...(await collectFilesByExtension(join(distDir, 'assets'), '.css')),
    ...(await collectFilesByExtension(join(distDir, 'assets'), '.js')),
  ].sort()
  const otherTexts = await mapConcurrent(otherFiles, IO_CONCURRENCY, async (file) => ({
    file,
    text: await readFile(file, 'utf8').catch(() => null),
  }))
  for (const { file, text } of otherTexts) {
    if (text) rememberAssets(file, text)
  }

  const assetErrors = await mapConcurrent([...assetOwners], IO_CONCURRENCY, async ([ref, file]) => {
    if (await builtAssetExists(distDir, ref)) return null
    return `${file}: missing public asset ${ref}\n  hint: ${missingPublicAssetHint(ref)}`
  })
  for (const error of assetErrors.filter((value): value is string => !!value).sort()) fail(error)

  const linkErrors = await mapConcurrent([...linkOwners], IO_CONCURRENCY, async ([href, file]) => {
    if (href.startsWith('/assets/') || href.startsWith('/media/') || href.startsWith('/lib/')) {
      if (!(await assetExists(distDir, href))) return `${file}: broken asset ${href}`
    } else if (href.endsWith('.html') || href.endsWith('.json') || href.endsWith('.md') || href.endsWith('.txt')) {
      if (!(await assetExists(distDir, href))) return `${file}: broken link ${href}`
    } else if (!(await routeExists(distDir, href))) {
      return `${file}: broken route ${href}`
    }
    return null
  })
  for (const error of linkErrors.filter((value): value is string => !!value).sort()) fail(error)
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

async function builtAssetExists(distRoot: string, ref: string) {
  const rel = decodeRef(ref.startsWith('/') ? ref.slice(1) : ref)
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

async function checkSiteJson(srcDir: string, fail: (m: string) => void) {
  try { await loadSiteConfig(join(srcDir, 'site.json')) } catch (error) {
    if (error instanceof BuildError) fail(error.toPretty())
    else fail(error instanceof Error ? error.message : String(error))
  }
}

async function checkSourceContracts(context: BuildContext, fail: (m: string) => void, warn: (m: string) => void, validatedBuildInputs: boolean) {
  await checkVercelConfig(context.rootDir, warn)

  const imageRoots = validatedBuildInputs ? [] : await imageSourceRoots(context.rootDir).catch((err) => {
    if (err instanceof BuildError) {
      fail(err.hint ? `${err.message}\n  hint: ${err.hint}` : err.message)
      return []
    }
    fail(err instanceof Error ? err.message : String(err))
    return []
  })
  if (!validatedBuildInputs) await assertUniqueImageNames(...imageRoots).catch((err) => {
    if (err instanceof BuildError) {
      fail(err.hint ? `${err.message}\n  hint: ${err.hint}` : err.message)
      return
    }
    fail(err instanceof Error ? err.message : String(err))
  })

  if (!validatedBuildInputs) {
    const routeSlugs = new Map<string, string>()
    for (const route of await discoverSourceRoutes({ srcDir: context.srcDir })) {
      routeSlugs.set(route.slug, route.sourceRel)
    }

    const contentRoutes = await compileContentFrom({ rootDir: context.rootDir, srcDir: context.srcDir }).catch((err) => {
      fail(err instanceof Error ? err.message : String(err))
      return []
    })
    for (const route of contentRoutes) {
      const existing = routeSlugs.get(route.slug)
      if (existing) fail(`${route.source}: content route collides with ${existing} at /${route.slug}/`)
    }
  }

  for (const template of ['post.html']) {
    const rel = `src/templates/${template}`
    const raw = await readFile(join(context.srcDir, 'templates', template), 'utf8').catch(() => '')
    if (!raw) continue
    if (!raw.includes('{{body}}')) fail(`${rel}: missing {{body}} placeholder`)
    if (!raw.includes('{{title}}')) warn(`${rel}: missing {{title}} placeholder`)
  }

  const customCollections = await loadCustomContentCollections(context.rootDir).catch((err) => {
    fail(err instanceof Error ? err.message : String(err))
    return []
  })
  for (const collection of customCollections) {
    const rel = `src/templates/${collection.template}`
    const raw = await readFile(join(context.srcDir, 'templates', collection.template), 'utf8').catch(() => '')
    if (!raw) {
      fail(`${rel}: missing custom collection template for "${collection.name}"`)
      continue
    }
    if (!raw.includes('{{body}}')) fail(`${rel}: missing {{body}} placeholder`)
    if (!raw.includes('{{title}}')) warn(`${rel}: missing {{title}} placeholder`)
  }

  const pages = await readFile(join(context.rootDir, '.pages.yml'), 'utf8').catch(() => '')
  if (pages) {
    try {
      checkPagesCmsConfig(pages, warn)
    } catch (err) {
      if (err instanceof BuildError) fail(err.hint ? `${err.message}\n  hint: ${err.hint}` : err.message)
      else fail(err instanceof Error ? err.message : String(err))
    }
  }

  await checkComponentActiveScripts(context.componentsDir, warn)
}

const COMPONENT_SCRIPT_RE = INLINE_SCRIPT_RE

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

async function checkComponentActiveScripts(componentsDir: string, warn: (m: string) => void) {
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

type VercelHeader = { key?: unknown; value?: unknown }
type VercelHeaderRule = { source?: unknown; headers?: unknown }

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

// The build names hashed assets `name.{8 hex}.ext` (framework/build/hash.ts). An immutable rule must match only those.
const HASH_GROUP_RE = /\[(?:a-f0-9|0-9a-f)\]\{8/

function hasCacheHeader(rule: VercelHeaderRule, valueIncludes: string) {
  if (!Array.isArray(rule.headers)) return false
  return rule.headers.some((header: VercelHeader) => header?.key === 'Cache-Control' && typeof header.value === 'string' && header.value.includes(valueIncludes))
}

const STYLESHEET_TAG_RE = /<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi
const SCRIPT_TAG_RE = /<script\b([^>]*)>/gi
const HREF_RE = /\bhref=("([^"]*)"|'([^']*)'|([^\s>]+))/i
const SRC_RE = /\bsrc=("([^"]*)"|'([^']*)'|([^\s>]+))/i

function tagAttr(tag: string, re: RegExp) {
  const match = tag.match(re)
  return match ? (match[2] ?? match[3] ?? match[4] ?? '') : ''
}

export async function checkEmitContracts(
  distDir: string,
  srcDir: string,
  fail: (m: string) => void,
  warn: (m: string) => void,
) {
  const stylesDir = join(srcDir, 'styles')
  for (const file of [
    ...await collectFilesByExtension(stylesDir, '.ttf'),
    ...await collectFilesByExtension(stylesDir, '.otf'),
  ]) {
    fail(`${file}: TTF and OTF fonts are not emitted\n  hint: Commit WOFF or WOFF2 under src/styles and point @font-face at those files.`)
  }

  for (const file of await collectPublicPages(distDir)) {
    const html = await readFile(file, 'utf8').catch(() => '')
    if (!html) continue
    if (html.includes('/__snz/hmr')) {
      fail(`${file}: HMR client leaked into production HTML\n  hint: HMR is injected only by the dev server. Rebuild without the dev injector.`)
    }

    const stylesheets: string[] = []
    for (const match of html.matchAll(STYLESHEET_TAG_RE)) {
      const tag = match[0]
      if (/\bdata-snz-route-css\b/i.test(tag)) continue
      if (/\bmedia=["']print["']/i.test(tag)) continue
      const href = tagAttr(tag, HREF_RE)
      if (href) stylesheets.push(href)
    }
    if (stylesheets.length > 2) {
      warn(`${file}: ${stylesheets.length} render-blocking stylesheets\n  hint: Keep project CSS and component CSS as the only head stylesheets. Route CSS may use data-snz-route-css.`)
    }

    const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? html
    for (const match of head.matchAll(SCRIPT_TAG_RE)) {
      const attrs = match[1] ?? ''
      const src = tagAttr(attrs, SRC_RE) || tagAttr(match[0], SRC_RE)
      if (!src) continue
      if (src === '/router.js') {
        fail(`${file}: unhashed /router.js\n  hint: The build should emit /assets/js/router.[hash].js.`)
      }
      const deferred = /\btype=["']module["']/i.test(attrs) || /\bdefer\b/i.test(attrs) || /\basync\b/i.test(attrs)
      if (!deferred) {
        warn(`${prettyFileLine(file, html, match.index ?? 0)}: render-blocking script ${src}\n  hint: Use type="module", defer, or async for head scripts.`)
      }
    }
  }

  const cssFiles = (await collectFilesByExtension(join(distDir, 'assets', 'css'), '.css'))
    .filter((file) => !file.includes(`${sep}routes${sep}`) && !file.endsWith(`${sep}lenis.css`))
    .sort()
  for (const file of cssFiles) {
    const css = await readFile(file, 'utf8').catch(() => '')
    if (!css) continue
    if (/@import\b/.test(css)) {
      warn(`${file}: emitted CSS still contains @import\n  hint: The build flattens src/styles.css. Avoid remote @import in project CSS.`)
    }
    if (/url\([^)]*\.(ttf|otf)(\?|#|["')])/i.test(css)) {
      fail(`${file}: emitted CSS still references TTF/OTF\n  hint: Point @font-face at WOFF or WOFF2 files under src/styles.`)
    }
  }
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
    if (config[key] !== value) warn(`${rel}: ${key} should be ${label} for sttc Bun static deploys`)
  }

  const headers = Array.isArray(config.headers) ? config.headers as VercelHeaderRule[] : []
  for (const rule of headers) {
    if (typeof rule.source !== 'string' || !hasCacheHeader(rule, 'immutable') || HASH_GROUP_RE.test(rule.source)) continue
    warn(`${rel}: immutable Cache-Control on "${rule.source}" is not limited to hashed assets; replaced media would stay cached. Match the hash group, e.g. /assets/(css|js)/(.*)\\.([a-f0-9]{8,})\\.(css|js|woff2?)`)
  }
  if (!headers.some((rule) => (
    typeof rule.source === 'string'
    && rule.source.includes('llms')
    && rule.source.includes('robots')
    && rule.source.includes('sitemap')
    && hasCacheHeader(rule, 'max-age=3600')
  ))) {
    warn(`${rel}: discovery files should use short Cache-Control headers`)
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

async function checkLaunchSiteConfig(context: BuildContext, fail: (m: string) => void) {
  const rel = 'src/site.json'
  const raw = await readFile(join(context.srcDir, 'site.json'), 'utf8').catch(() => '')
  let site: Record<string, unknown>
  try { site = JSON.parse(raw) } catch { return }
  const url = typeof site.url === 'string' ? site.url : ''
  if (!/^https:\/\/[^\s/$.?#].[^\s]*$/i.test(url) || /localhost|127\.0\.0\.1|0\.0\.0\.0|\.local\b|example\.com/i.test(url)) {
    fail(`${rel}: launch site.url must be a public https URL\n  hint: Set site.url to the production origin before launch.`)
  }
  const image = typeof site.image === 'string' ? site.image : typeof site.ogImage === 'string' ? site.ogImage : ''
  if (!image) fail(`${rel}: launch image missing\n  hint: Set image to a real social preview image path.`)

  const master = sourceOgImagePath(context.rootDir)
  const og = await readFile(master).then((bytes) => new Bun.Image(bytes).metadata()).catch(() => null)
  if (!og) fail(`${master}: launch OG master missing or unreadable\n  hint: Add a 1200×630 og.png under src/images.`)
  else if ((og.width ?? 0) < 600 || (og.height ?? 0) < 315) fail(`${master}: launch OG master is ${og.width}×${og.height}; needs at least 600×315\n  hint: Replace the placeholder with a real 1200×630 social image.`)

  const starter = join(packageRoot, '..', 'templates', 'default', 'src')
  const starterSite = JSON.parse(await readFile(join(starter, 'site.json'), 'utf8').catch(() => '{}'))
  for (const key of ['name', 'description']) {
    if (site[key] && site[key] === starterSite[key]) fail(`${rel}: launch ${key} is the starter's placeholder "${site[key]}"\n  hint: Set site.${key} for the real site.`)
  }
  const seoTitle = async (file: string) => (await readFile(file, 'utf8').catch(() => '')).match(/<SEO\b[^>]*\stitle=["']([^"']*)["']/)?.[1]
  const indexTitle = await seoTitle(join(context.srcDir, 'pages', 'index.html'))
  if (indexTitle && indexTitle === await seoTitle(join(starter, 'pages', 'index.html'))) {
    fail(`src/pages/index.html: launch title is the starter's placeholder "${indexTitle}"\n  hint: Give the home page its own title.`)
  }
}

async function checkPrivateOutputUrls(distDir: string, fail: (m: string) => void) {
  const files = [...(await collectPublicPages(distDir)), ...(await collectFilesByExtension(distDir, '.json'))]
  const privateUrl = /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|[^\s"'<>]+\.local\b)/i
  for (const file of files) {
    const text = await readFile(file, 'utf8').catch(() => '')
    const m = text.match(privateUrl)
    if (m?.index !== undefined) fail(`${prettyFileLine(file, text, m.index)}: private URL in output\n  hint: Replace localhost/private URLs with production URLs before launch.`)
  }
}

async function checkDraftLeakage(context: BuildContext, fail: (m: string) => void) {
  const content = await compileContentFrom({ rootDir: context.rootDir, srcDir: context.srcDir }).catch(() => [])
  for (const route of content) {
    if (route.draft) fail(`${route.source}: draft content included in production build\n  hint: Draft content must not emit during launch checks.`)
  }
}

async function checkLaunchReadiness(context: BuildContext, fail: (m: string) => void, warn: (m: string) => void) {
  await checkLaunchSiteConfig(context, fail)
  const files = await collectPublicPages(context.distDir)
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
  await checkPrivateOutputUrls(context.distDir, fail)
  await checkDraftLeakage(context, fail)
  await checkPostAuthors(context, warn)
}

async function checkPostAuthors(context: BuildContext, warn: (m: string) => void) {
  const content = await compileContentFrom({ rootDir: context.rootDir, srcDir: context.srcDir }).catch(() => [])
  for (const route of content) {
    if (route.collection !== 'posts' || route.draft) continue
    if (route.data.author?.trim()) continue
    warn(`${route.source}: public post has no author\n  hint: Set front-matter author and a matching site.author or site.authors entry.`)
  }
}

async function checkDiscoveryArtifacts(distDir: string, fail: (m: string) => void) {
  const required = [
    'llms.txt',
    'llms-full.txt',
    'site.manifest.json',
    'site.jsonld',
  ]
  for (const rel of required) {
    if (!(await assetExists(distDir, `/${rel}`))) fail(`missing dist/${rel}`)
  }
  try {
    const manifest = JSON.parse(await readFile(join(distDir, 'site.manifest.json'), 'utf8'))
    if (!Array.isArray(manifest.routes) || !manifest.routes.length) fail('site.manifest.json: routes array empty or missing')
    if (!Array.isArray(manifest.components)) fail('site.manifest.json: components array missing')
    if (manifest.schemaVersion !== 2) fail('site.manifest.json: unsupported schemaVersion')
    for (const route of manifest.routes ?? []) {
      const representations = route.representations
      if (!representations || typeof representations.html !== 'string' || typeof representations.markdown !== 'string' || typeof representations.metadata !== 'string') {
        fail(`site.manifest.json: route ${String(route.slug)} representations incomplete`)
        continue
      }
      for (const rel of [representations.html, representations.markdown, representations.metadata]) {
        if (!(await assetExists(distDir, rel))) fail(`site.manifest.json: missing route representation ${rel}`)
      }
    }
  } catch {
    fail('site.manifest.json: invalid JSON')
  }
}

// CLI entry — `bun run check`
if (import.meta.main) {
  const skipBuild = process.argv.includes('--skip-build')
  const allowBrokenLinks = process.argv.includes('--allow-broken-links')
  const launch = process.argv.includes('--launch')
  if (!skipBuild) {
    const buildArgs = ['bun', join(packageRoot, 'build', 'index.ts')]
    if (allowBrokenLinks) buildArgs.push('--allow-broken-links')
    if (launch) buildArgs.push('--launch')
    const proc = Bun.spawn(buildArgs, { cwd: root, stdout: 'inherit', stderr: 'inherit' })
    const code = await proc.exited
    if (code !== 0) process.exit(code)
    console.log(launch ? 'launch check ok' : 'check ok')
    process.exit(0)
  }
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
      { hint: 'Fix the listed issues. --allow-broken-links skips only the broken route and link checks.' },
    )
  }
}
