import { mkdir, readdir, readFile, rm, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { createComposer } from './compose'
import {
  bundleComponentCss,
  injectComponentStylesLink,
  prepareComponents,
} from './extract-css'
import {
  componentScriptBlocks,
  extractRouteTopScripts,
  extractShellHeadScripts,
  routeScriptBlocks,
  writeAppJs,
  type ScriptBlock,
} from './extract-js'
import {
  assertImageApi,
  assertUniqueImageNames,
  processImages,
  processOgImage,
  pruneStaleImages,
  pruneStaleVariants,
  type ImageMeta,
} from './images'
import { scanImageEncodeOptions } from './scan-images'
import {
  componentsDir,
  dist,
  root,
  shellFile,
  siteFile,
  sourceAppDir,
  sourceAppFile,
  sourceImagesDir,
  sourceRouterFile,
  sourceRuntimeLibDir,
  sourceStylesDir,
  src,
} from './paths'
import { writeRobots, writeSitemap, type SiteConfig } from './seo'
import { compileContent, slugifyTag, type ContentRoute } from './content'
import { writeFeeds } from './feeds'
import { BuildError } from './errors'
import { runChecks, failOnReport } from './check'
import {
  extractTitle,
  extractDescription,
  scanInternalLinks,
  writeDiscovery,
  type RouteRecord,
} from './discovery'
import type { ComposeInstance } from './compose'
import { writeComponentsReadme } from './docs'

async function writeComposed(
  srcPath: string,
  destPath: string,
  prepare: (raw: string, name: string) => Promise<string>,
) {
  const raw = await readFile(srcPath, 'utf8')
  const name = srcPath.split('/').pop() ?? ''
  const html = await prepare(raw, name)
  await mkdir(join(destPath, '..'), { recursive: true })
  await writeFile(destPath, html)
}

// Recursive copy implemented with sequential per-file writes. fs.cp(recursive: true) was
// observed to race with adjacent writes (image variants would vanish), so we walk + Bun.write.
// Skips files whose dest is already up to date — avoids reading src files unnecessarily,
// which on macOS causes fs.watch to fire spurious "change" events (atime touch).
async function copyTree(srcDir: string, destDir: string, skip: (relPath: string) => boolean = () => false) {
  let entries
  try { entries = await readdir(srcDir, { withFileTypes: true }) } catch { return }
  await mkdir(destDir, { recursive: true })
  for (const entry of entries) {
    if (entry.name === '.DS_Store' || entry.name === '.gitkeep') continue
    if (skip(entry.name)) continue
    const srcPath = join(srcDir, entry.name)
    const destPath = join(destDir, entry.name)
    if (entry.isDirectory()) {
      await copyTree(srcPath, destPath, skip)
    } else if (entry.isFile()) {
      const srcStat = await stat(srcPath).catch(() => null)
      const destStat = await stat(destPath).catch(() => null)
      if (srcStat && destStat && destStat.mtimeMs >= srcStat.mtimeMs && destStat.size === srcStat.size) {
        continue // already up to date
      }
      await Bun.write(destPath, Bun.file(srcPath))
    }
  }
}

async function copyAssets() {
  const assetsDist = join(dist, 'assets')
  await mkdir(assetsDist, { recursive: true })

  // Wipe stale js bundles so old hashed app.*.js bundles don't linger.
  await rm(join(assetsDist, 'js'), { recursive: true, force: true })

  await copyTree(await sourceStylesDir(), join(assetsDist, 'css'))
  await copyTree(await sourceAppDir(), join(assetsDist, 'js'), (name) => name === 'app.js')
  await mkdir(join(assetsDist, 'images'), { recursive: true })
}

async function copyMediaFolder() {
  // media/images is source input for the optimizer, not a public raw asset tree.
  // Other media folders can still be copied for non-image CMS files if added later.
  await rm(join(dist, 'media', 'images'), { recursive: true, force: true })
  const mediaSrc = join(root, 'media')
  try {
    if ((await stat(mediaSrc)).isDirectory()) {
      await copyTree(mediaSrc, join(dist, 'media'), (name) => name === 'images')
    }
  } catch {
    /* no media folder */
  }
}

function postLinkList(posts: ContentRoute[]) {
  return posts
    .sort((a, b) => (b.data.date ?? '').localeCompare(a.data.date ?? ''))
    .map((p) => `
  <article class="post-item">
    <h2 class="post-item-title"><a href="/${p.slug}/">${escapeHtmlBasic(p.data.title)}</a></h2>
    <p class="post-item-meta"><time datetime="${p.data.date ?? ''}">${p.data.date ?? ''}</time></p>
    <p class="post-item-desc">${escapeHtmlBasic(p.data.description ?? '')}</p>
  </article>`)
    .join('\n')
}

function escapeHtmlBasic(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

async function autoGenerateIndexes(
  composer: ReturnType<typeof createComposer>,
  posts: ContentRoute[],
  routeRecords: RouteRecord[],
  routeSlugs: string[],
) {
  if (!posts.length) return

  // /insights/ — list all posts
  const insightsExists = await Bun.file(join(src, 'routes', 'insights.html')).exists()
  if (!insightsExists) {
    const body = `<head>
  <SEO title="Insights" description="All posts." path="/insights/" />
</head>
<Section>
  <h1>Insights</h1>
  ${postLinkList(posts)}
</Section>`
    const html = await composer.prepareRouteSource(body, 'insights.html')
    await mkdir(join(dist, 'routes'), { recursive: true })
    await writeFile(join(dist, 'routes', 'insights.html'), html)
    routeSlugs.push('insights')
    routeRecords.push({
      slug: 'insights',
      title: 'Insights',
      description: 'All posts.',
      components: [],
      internalLinks: posts.map((p) => `/${p.slug}/`),
      schemas: ['CollectionPage'],
      lastModified: new Date().toISOString(),
    })
  }

  // /tags/{tag}/ — one index per unique tag
  const byTag = new Map<string, { label: string; posts: ContentRoute[] }>()
  for (const p of posts) {
    for (const t of p.tags) {
      const slug = slugifyTag(t)
      if (!slug) continue
      if (!byTag.has(slug)) byTag.set(slug, { label: t, posts: [] })
      byTag.get(slug)!.posts.push(p)
    }
  }
  if (byTag.size === 0) return

  for (const [tagSlug, group] of byTag) {
    const { label, posts: postsForTag } = group
    const body = `<head>
  <SEO title="Tag: ${label}" description="Posts tagged ${label}." path="/tags/${tagSlug}/" />
</head>
<Section>
  <h1>Tag: <code>${label}</code></h1>
  ${postLinkList(postsForTag)}
  <p><a href="/tags/">← All tags</a></p>
</Section>`
    const html = await composer.prepareRouteSource(body, `tags/${tagSlug}.html`)
    await mkdir(join(dist, 'routes', 'tags'), { recursive: true })
    await writeFile(join(dist, 'routes', 'tags', `${tagSlug}.html`), html)
    routeSlugs.push(`tags/${tagSlug}`)
    routeRecords.push({
      slug: `tags/${tagSlug}`,
      title: `Tag: ${label}`,
      description: `Posts tagged ${label}.`,
      components: [],
      internalLinks: postsForTag.map((p) => `/${p.slug}/`),
      schemas: ['CollectionPage'],
      lastModified: new Date().toISOString(),
    })
  }

  // /tags/ — index of all tags
  const tagLinks = [...byTag.entries()]
    .sort(([, a], [, b]) => a.label.localeCompare(b.label))
    .map(([slug, group]) => `<li><a href="/tags/${slug}/">${group.label}</a> <small>(${group.posts.length})</small></li>`)
    .join('\n  ')
  const body = `<head>
  <SEO title="Tags" description="All tags." path="/tags/" />
</head>
<Section>
  <h1>Tags</h1>
  <ul>
  ${tagLinks}
  </ul>
</Section>`
  const html = await composer.prepareRouteSource(body, 'tags.html')
  await writeFile(join(dist, 'routes', 'tags.html'), html)
  routeSlugs.push('tags')
  routeRecords.push({
    slug: 'tags',
    title: 'Tags',
    description: 'All tags.',
    components: [],
    internalLinks: [...byTag.keys()].map((t) => `/tags/${t}/`),
    schemas: ['CollectionPage'],
    lastModified: new Date().toISOString(),
  })
}

async function build() {
  assertImageApi()

  const t0 = performance.now()
  const timings: Record<string, number> = {}
  const tick = (label: string, start: number) => { timings[label] = Math.round(performance.now() - start) }

  let t = performance.now()
  const { cssBlocks, templates, schemas, scripts: componentScripts } = await prepareComponents(componentsDir)
  tick('components', t)
  let imageMeta: Record<string, ImageMeta> = {}
  const instancesByRoute = new Map<string, ComposeInstance[]>()
  const componentUseCounts = new Map<string, number>()
  const scriptComponentNames = new Set(componentScripts.keys())
  const composer = createComposer(
    templates,
    schemas,
    () => imageMeta,
    (inst) => {
      const route = inst.route ?? '__shell__'
      if (!instancesByRoute.has(route)) instancesByRoute.set(route, [])
      instancesByRoute.get(route)!.push(inst)
      componentUseCounts.set(inst.name, (componentUseCounts.get(inst.name) ?? 0) + 1)
    },
    scriptComponentNames,
  )
  composer.resetSiteConfig()

  await rm(join(dist, 'routes'), { recursive: true, force: true })
  await rm(join(dist, 'index.html'), { force: true }).catch(() => {})
  await mkdir(dist, { recursive: true })
  await mkdir(join(dist, 'routes'), { recursive: true })

  // Images first — fs.cp(recursive: true) on sibling dirs has been observed to race with
  // subsequent writes (variants get truncated). Encoding before any cp call avoids it.
  t = performance.now()
  const imageEncode = await scanImageEncodeOptions(src, componentsDir)
  const imagesSrc = await sourceImagesDir()
  const imagesDist = join(dist, 'assets', 'images')
  const assetsDist = join(dist, 'assets')
  await mkdir(imagesDist, { recursive: true })
  await assertUniqueImageNames(imagesSrc, join(root, 'media', 'images'))
  // (Variant pruning intentionally removed — it raced with the cache check in processImages.
  // Stale variants are harmless: srcset only references widths the current sidecar reports.)
  const srcMeta = await processImages(imagesSrc, imagesDist, imageEncode)
  const mediaMeta = await processImages(join(root, 'media', 'images'), imagesDist, imageEncode)
  imageMeta = { ...mediaMeta, ...srcMeta }
  await pruneStaleImages(imagesDist, Object.keys(imageMeta))
  await processOgImage(join(imagesSrc, 'og.png'), assetsDist)
  tick('images', t)

  t = performance.now()
  await copyAssets()
  await copyMediaFolder()
  tick('assets', t)

  const componentsCssDir = join(dist, 'assets', 'css')
  const componentsCssFile = await bundleComponentCss(cssBlocks, componentsCssDir)

  const scriptBlocks: ScriptBlock[] = []

  const shellRaw = await readFile(shellFile, 'utf8')
  const { blocks: shellScripts } = extractShellHeadScripts(shellRaw)
  scriptBlocks.push(...shellScripts)
  // Component lifecycle scripts registered before any route scripts run.
  scriptBlocks.push(...componentScriptBlocks(componentScripts))

  // Compose shell first, then defer writing it until app.js is hashed so we can substitute the script src.
  const composedShell = await (async () => {
    const { html: stripped } = extractShellHeadScripts(shellRaw)
    const composed = await composer.prepareShellSource(stripped)
    return injectComponentStylesLink(composed, componentsCssFile)
  })()

  t = performance.now()
  const routeSlugs: string[] = []
  const routeRecords: RouteRecord[] = []

  async function recordFromHtml(slug: string, finalHtml: string): Promise<RouteRecord> {
    return {
      slug,
      title: extractTitle(finalHtml),
      description: extractDescription(finalHtml),
      components: instancesByRoute.get(slug) ?? [],
      internalLinks: scanInternalLinks(finalHtml),
      schemas: ['WebPage'],
      lastModified: new Date().toISOString(),
    }
  }

  for (const name of await readdir(join(src, 'routes'))) {
    if (!name.endsWith('.html')) continue
    const routeRaw = await readFile(join(src, 'routes', name), 'utf8')
    const slug = composer.slugFromRouteFile(name)
    routeSlugs.push(slug)
    const { scripts } = extractRouteTopScripts(routeRaw, name)
    scriptBlocks.push(...routeScriptBlocks(slug, scripts))

    const { body } = extractRouteTopScripts(routeRaw, name)
    const html = await composer.prepareRouteSource(body, name)
    const outPath = join(dist, 'routes', name)
    await mkdir(join(outPath, '..'), { recursive: true })
    await writeFile(outPath, html)
    routeRecords.push(await recordFromHtml(slug, html))
  }

  // Compile content/posts and content/pages via templates → dist/routes/...
  const contentRoutes = await compileContent()
  const contentByslug = new Map<string, ContentRoute>()
  for (const c of contentRoutes) {
    routeSlugs.push(c.slug)
    contentByslug.set(c.slug, c)
    const html = await composer.prepareRouteSource(c.body, c.routeFile)
    const out = join(dist, 'routes', c.routeFile)
    await mkdir(join(out, '..'), { recursive: true })
    await writeFile(out, html)
    routeRecords.push(await recordFromHtml(c.slug, html))
  }

  tick('routes', t)

  t = performance.now()
  const site = JSON.parse(await readFile(siteFile, 'utf8')) as SiteConfig

  // Auto-generate /insights/ index + /tags/{tag}/ + /tags/ index if not authored manually.
  const posts = contentRoutes.filter((c) => c.collection === 'posts' && !c.draft)
  await autoGenerateIndexes(composer, posts, routeRecords, routeSlugs)

  await writeSitemap(dist, site.url, routeSlugs)
  await writeRobots(dist, site.url)
  await writeFeeds(dist, site, posts)

  await writeComponentsReadme(root, templates, schemas)

  await writeDiscovery(dist, {
    site,
    routes: routeRecords,
    componentSchemas: schemas,
    componentUseCounts,
    contentByslug,
  })
  tick('discovery', t)

  const appJsFile = await writeAppJs(
    await sourceAppFile('app.js'),
    join(dist, 'assets', 'js'),
    scriptBlocks,
  )

  // Substitute hashed asset paths into the shell, then write index.html.
  const indexHtml = composedShell
    .replace(/<script src="\/assets\/js\/app\.js"/, `<script src="/assets/js/${appJsFile}"`)
  await writeFile(join(dist, 'index.html'), indexHtml)

  await Bun.write(join(dist, 'router.js'), Bun.file(await sourceRouterFile()))
  await copyTree(await sourceRuntimeLibDir(), join(dist, 'lib'))

  t = performance.now()
  const allowBrokenLinks = process.argv.includes('--allow-broken-links')
  const report = await runChecks({ allowBrokenLinks })
  await failOnReport(report)
  tick('check', t)

  const total = Math.round(performance.now() - t0)
  console.log(
    Object.entries(timings).map(([k, v]) => `${k} ${v}ms`).join(' · ') +
    ` · total ${total}ms`,
  )
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

async function writeErrorPage(err: unknown) {
  const isBuild = err instanceof BuildError
  const title = isBuild ? 'Build error' : 'Build failed'
  const msg = err instanceof Error ? err.message : String(err)
  const file = isBuild ? err.file ?? '' : ''
  const hint = isBuild ? err.hint ?? '' : ''
  const stack = err instanceof Error ? err.stack ?? '' : ''
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
:root { color-scheme: dark; --r:#ff3b30; --bg:#0a0a0a; --fg:#fafafa; --a:#666; --c:#1c1c1c; }
* { box-sizing: border-box }
body { font: 15px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--bg); color: var(--fg); margin: 0; padding: 2rem; }
main { max-width: 60ch; margin: 4rem auto; }
.tag { display: inline-block; padding: .25em .5em; background: var(--r); color: white; font-weight: 600; border-radius: 4px; font-size: 12px; }
h1 { margin: .5em 0 1em; font-size: 1.5em; font-weight: 600; text-wrap: balance; }
.file { color: var(--a); margin-bottom: 1.5em; }
.hint { padding: 1em; background: var(--c); border-left: 2px solid var(--r); border-radius: 4px; margin-bottom: 1.5em; }
.hint::before { content: 'hint: '; color: var(--a); }
pre { background: var(--c); padding: 1em; border-radius: 4px; overflow-x: auto; font-size: 12px; color: var(--a); }
.refresh { margin-top: 2em; color: var(--a); font-size: 13px; }
</style>
</head>
<body>
<main>
  <span class="tag">${escapeHtml(title)}</span>
  <h1>${escapeHtml(msg)}</h1>
  ${file ? `<p class="file">${escapeHtml(file)}</p>` : ''}
  ${hint ? `<div class="hint">${escapeHtml(hint)}</div>` : ''}
  ${stack ? `<details><summary>Stack</summary><pre>${escapeHtml(stack)}</pre></details>` : ''}
  <p class="refresh">Save a file to retry. This page is served by the dev server while the build is broken.</p>
</main>
</body>
</html>`
  try {
    await mkdir(dist, { recursive: true })
    await writeFile(join(dist, '__build-error.html'), html)
  } catch {}
}

try {
  await build()
  // Clear any previous error banner
  try { await rm(join(dist, '__build-error.html'), { force: true }) } catch {}
} catch (err) {
  await writeErrorPage(err)
  if (err instanceof BuildError) {
    console.error(err.toPretty())
  } else {
    console.error(err)
  }
  process.exit(1)
}
