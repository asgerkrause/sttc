import { mkdir, readFile, rename, rm, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { createComposer } from './compose'
import {
  bundleComponentCss,
  bundleRouteCss,
  extractRouteStyleBlocks,
  injectComponentStylesLink,
  injectGlobalStylesLink,
  prepareComponents,
  routeCssLink,
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
  imageSourceRoots,
  processImageSources,
  processOgImage,
  pruneStaleImages,
  sourceOgImagePath,
  type ImageMeta,
} from './images'
import {
  DEFAULT_IMAGE_MAX,
  DEFAULT_IMAGE_QUALITY,
  imageEncodeOptionsFromAttrs,
  imageNameFromSrc,
  scanImageEncodeOptions,
  type ImageEncodeOptions,
} from './scan-images'
import {
  sourceAppFile,
  sourceRouterFile,
  sourceRuntimeLibDir,
} from './paths'
import { absoluteUrl, buildSchemaGraph, isPublicRoute, writeRobots, writeSitemap, type JsonLdNode, type SiteConfig } from './seo'
import { compileContentFrom, type ContentRoute } from './content'
import { writeFeeds } from './feeds'
import { BuildError } from './errors'
import { copyAssetsTo, copyMediaFolderTo, copyTree } from './assets'
import { autoGenerateIndexes } from './generated-routes'
import { extractTemplateData } from './template-data'
import { runChecks, failOnReport } from './check'
import { routeSchemaExtras, writeDiscovery, type RouteRecord } from './discovery'
import type { ComposeInstance } from './compose'
import { writeComponentsReadme } from './docs'
import { discoverSourceRoutes } from './source-files'
import { RouteGraph, type ComposedRoute } from './route-graph'
import { publicPathFromSlug } from '../runtime/lib/paths.js'
import { createBuildContext, type BuildContext, type BuildContextOptions, type BuildResult } from './build-context'
import { mapConcurrent } from './concurrency'
import { loadSiteConfig } from './site-config'
import type { TemplateValue } from './template-directives'

function assertImageEncodePlan(
  instancesByRoute: Map<string, ComposeInstance[]>,
  planned: Record<string, ImageEncodeOptions>,
) {
  const concrete = new Map<string, ImageEncodeOptions>()
  for (const instances of instancesByRoute.values()) {
    for (const instance of instances) {
      if (instance.name !== 'Image') continue
      const name = imageNameFromSrc(instance.attrs.src ?? '')
      const next = imageEncodeOptionsFromAttrs(instance.attrs)
      const previous = concrete.get(name)
      concrete.set(name, previous
        ? { max: Math.max(previous.max, next.max), quality: Math.max(previous.quality, next.quality) }
        : next)
    }
  }

  for (const [name, options] of concrete) {
    const encoded = planned[name] ?? { max: DEFAULT_IMAGE_MAX, quality: DEFAULT_IMAGE_QUALITY }
    if (encoded.max === options.max && encoded.quality === options.quality) continue
    // lazy: forwarded encode controls fail instead of silently producing the wrong asset.
    // Ceiling: max/quality must be statically visible. Upgrade when image planning moves after composition.
    throw new BuildError(`Image "${name}" has dynamic max or quality that cannot be planned before encoding`, {
      hint: 'Use a direct <Image src="name" ... /> where max and quality are statically visible, or omit those encode controls in wrapper components.',
    })
  }
}

function splitRouteHtml(html: string) {
  const match = html.match(/^<head[^>]*>([\s\S]*?)<\/head>\s*([\s\S]*)$/i)
  if (!match) return { head: '', body: html }
  return { head: match[1].trim(), body: match[2].trim() }
}

function withAppJs(shellHtml: string, appJsFile: string) {
  return shellHtml.replace(/<script src="\/assets\/js\/app\.js"/, `<script src="/assets/js/${appJsFile}"`)
}

function markRouteHead(routeHead: string) {
  return routeHead.replace(/<(title|meta|link|script)(\s[^>]*?)?>/gi, (tag) => tag.replace(/>$/, ' data-snz-head>'))
}

function applyRouteHead(shellHtml: string, routeHead: string) {
  const seoBlock = /<title>[\s\S]*?<script type="application\/ld\+json">[\s\S]*?<\/script>/
  const markedHead = markRouteHead(routeHead)
  if (seoBlock.test(shellHtml)) return shellHtml.replace(seoBlock, markedHead)
  return shellHtml.replace('</head>', `  ${markedHead.replace(/\n/g, '\n  ')}\n</head>`)
}

function moveRouteCssLinksLast(html: string) {
  const routeLinks: string[] = []
  const withoutRouteLinks = html.replace(/\n?\s*<link rel="stylesheet" href="\/assets\/css\/routes\/[^"]+" data-snz-route-css data-snz-head>/g, (link) => {
    routeLinks.push(link.trim())
    return ''
  })
  if (!routeLinks.length) return html

  const insert = `\n${routeLinks.map((link) => `  ${link}`).join('\n')}`
  const componentLink = /\n\s*<link rel="stylesheet" href="\/assets\/css\/components\.[a-f0-9]+\.css">/
  if (componentLink.test(withoutRouteLinks)) {
    return withoutRouteLinks.replace(componentLink, (match) => `${match}${insert}`)
  }

  const stylesLink = /\n\s*<link rel="stylesheet" href="\/assets\/css\/styles\.css">/
  if (stylesLink.test(withoutRouteLinks)) {
    return withoutRouteLinks.replace(stylesLink, (match) => `${match}${insert}`)
  }

  return withoutRouteLinks.replace('</head>', `${insert}\n</head>`)
}

function replaceSchemaJson(routeHead: string, graph: unknown) {
  const json = JSON.stringify(graph).replace(/</g, '\\u003c')
  const schemaBlock = /<script type="application\/ld\+json">[\s\S]*?<\/script>/
  const next = `<script type="application/ld+json">${json}</script>`
  return schemaBlock.test(routeHead) ? routeHead.replace(schemaBlock, next) : `${routeHead}\n${next}`
}

function enrichRouteHead(routeHead: string, site: SiteConfig, record: RouteRecord, extraJsonLd: JsonLdNode[]) {
  if (!extraJsonLd.length) return routeHead
  const graph = buildSchemaGraph(site, {
    title: record.title,
    description: record.description,
    canonical: absoluteUrl(site.url, publicPathFromSlug(record.slug)),
  }, extraJsonLd)
  return replaceSchemaJson(routeHead, graph)
}

function injectRouteBody(shellHtml: string, routeBody: string) {
  return shellHtml.replace(/<main(?:\s+data-route-root)?><\/main>/, `<main>\n${routeBody}\n  </main>`)
}

function publicRoutePath(distDir: string, slug: string) {
  if (slug === 'index') return join(distDir, 'index.html')
  return join(distDir, slug, 'index.html')
}

function markStaticRoute(html: string, slug: string) {
  return html.replace(/<html(\s|>)/i, `<html data-snz-route="${escapeHtml(slug)}"$1`)
}

async function writeStaticRoutes(
  distDir: string,
  shellHtml: string,
  routes: ComposedRoute[],
  records: RouteRecord[],
  extrasBySlug: Map<string, JsonLdNode[]>,
  site: SiteConfig,
) {
  const recordsBySlug = new Map(records.map((record) => [record.slug, record]))
  await mapConcurrent(routes, 4, async (route) => {
    const { head, body } = splitRouteHtml(route.html)
    const record = recordsBySlug.get(route.slug)
    const routeHead = record ? enrichRouteHead(head, site, record, extrasBySlug.get(route.slug) ?? []) : head
    const html = markStaticRoute(
      moveRouteCssLinksLast(injectRouteBody(applyRouteHead(shellHtml, routeHead), body)),
      route.slug,
    )
    const path = publicRoutePath(distDir, route.slug)
    await mkdir(join(path, '..'), { recursive: true })
    await writeFile(path, html)
  })
}

export type BuildOptions = BuildContextOptions & {
  context?: BuildContext
}

async function exists(path: string) {
  try { await stat(path); return true } catch { return false }
}

async function acquireBuildLock(context: BuildContext) {
  const stateDir = join(context.rootDir, '.snz')
  const lockDir = join(stateDir, 'build.lock')
  await mkdir(stateDir, { recursive: true })
  const deadline = Date.now() + 30_000

  while (Date.now() < deadline) {
    try {
      await mkdir(lockDir)
      await Bun.write(join(lockDir, 'pid'), String(process.pid))
      return async () => { await rm(lockDir, { recursive: true, force: true }) }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      const owner = Number(await readFile(join(lockDir, 'pid'), 'utf8').catch(() => ''))
      let alive = Number.isInteger(owner) && owner > 0
      if (alive) {
        try { process.kill(owner, 0) } catch { alive = false }
      }
      const age = Date.now() - await stat(lockDir).then((entry) => entry.mtimeMs).catch(() => 0)
      if (!alive && age >= 2_000) {
        await rm(lockDir, { recursive: true, force: true })
        continue
      }
      await Bun.sleep(25)
    }
  }

  throw new BuildError('Timed out waiting for another build to finish.', {
    file: '.snz/build.lock',
    hint: 'Wait for the active build, or remove a stale .snz/build.lock after confirming no build process is running.',
  })
}

function stagedDistDir(context: BuildContext) {
  return `${context.distDir}.__next-${process.pid}-${Date.now()}`
}

function backupDistDir(context: BuildContext) {
  return `${context.distDir}.__prev-${process.pid}-${Date.now()}`
}

function withDistDir(context: BuildContext, distDir: string): BuildContext {
  return { ...context, distDir }
}

async function publishStagedDist(context: BuildContext, stageDir: string) {
  const backupDir = backupDistDir(context)
  let backedUp = false
  try {
    await rm(backupDir, { recursive: true, force: true })
    if (await exists(context.distDir)) {
      await rename(context.distDir, backupDir)
      backedUp = true
    }
    await rename(stageDir, context.distDir)
    return backupDir
  } catch (err) {
    await rm(context.distDir, { recursive: true, force: true }).catch(() => {})
    if (backedUp) await rename(backupDir, context.distDir).catch(() => {})
    throw err
  }
}

async function restorePublishedDist(context: BuildContext, backupDir: string) {
  await rm(context.distDir, { recursive: true, force: true }).catch(() => {})
  if (await exists(backupDir)) await rename(backupDir, context.distDir)
}

async function seedBuildCache(previousDist: string, stageDir: string, projectRoot: string) {
  const previousImages = join(previousDist, 'assets', 'images')
  const stageImages = join(stageDir, 'assets', 'images')
  await copyTree(previousImages, stageImages, (relPath) => {
    const rel = relPath.replace(/\\/g, '/')
    return !rel.endsWith('.webp') && rel !== '.meta' && !rel.startsWith('.meta/')
  })

  if (await Bun.file(await sourceOgImagePath(projectRoot)).exists()) {
    for (const rel of ['og.webp', 'og.png', '.meta/og.json']) {
      const source = join(previousDist, 'assets', rel)
      if (!(await Bun.file(source).exists())) continue
      const target = join(stageDir, 'assets', rel)
      await mkdir(join(target, '..'), { recursive: true })
      await Bun.write(target, Bun.file(source))
    }
  }
}

export async function build(options: BuildOptions = {}): Promise<BuildResult> {
  const context = options.context ?? createBuildContext(options)
  const totalStarted = performance.now()
  const lockStarted = performance.now()
  const releaseBuildLock = await acquireBuildLock(context)
  const lockMs = Math.round(performance.now() - lockStarted)
  const stageDir = stagedDistDir(context)
  const stageContext = withDistDir(context, stageDir)
  let backupDir: string | null = null
  let result: BuildResult

  try {
    await rm(stageDir, { recursive: true, force: true })
    await seedBuildCache(context.distDir, stageDir, context.rootDir)
    result = await buildInto(stageContext)
    result.timings.lock = lockMs
    let t = performance.now()
    backupDir = await publishStagedDist(context, stageDir)
    result.timings.publish = Math.round(performance.now() - t)
    t = performance.now()
    const report = await runChecks({
      context,
      allowBrokenLinks: context.flags.allowBrokenLinks,
      validatedBuildInputs: true,
    })
    await failOnReport(report)
    result.timings.check = Math.round(performance.now() - t)
    result.totalMs = Math.round(performance.now() - totalStarted)
    if (process.argv.includes('--profile')) {
      console.log(
        Object.entries(result.timings).map(([k, v]) => `${k} ${v}ms`).join(' · ') +
        ` · total ${result.totalMs}ms`,
      )
    } else {
      console.log(`built ${result.routes.length} routes in ${result.totalMs}ms`)
    }
    return { ...result, context }
  } catch (err) {
    if (backupDir) await restorePublishedDist(context, backupDir)
    throw err
  } finally {
    await rm(stageDir, { recursive: true, force: true }).catch(() => {})
    if (backupDir) await rm(backupDir, { recursive: true, force: true }).catch(() => {})
    await releaseBuildLock()
  }
}

async function buildInto(context: BuildContext): Promise<BuildResult> {
  assertImageApi()

  const t0 = performance.now()
  const timings: Record<string, number> = {}
  const tick = (label: string, start: number) => { timings[label] = Math.round(performance.now() - start) }

  let t = performance.now()
  const site = await loadSiteConfig(context.siteFile)
  const { cssBlocks, templates, schemas, scripts: componentScripts, data: componentData } = await prepareComponents(context.componentsDir, context.rootDir)
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
    componentData,
    { siteFile: context.siteFile },
  )
  composer.resetSiteConfig()

  // The stage is unique. It may contain only validated image-cache artifacts seeded by build().
  await mkdir(context.distDir, { recursive: true })
  await mkdir(join(context.distDir, 'routes'), { recursive: true })

  // Images first — fs.cp(recursive: true) on sibling dirs has been observed to race with
  // subsequent writes (variants get truncated). Encoding before any cp call avoids it.
  t = performance.now()
  const imageEncode = await scanImageEncodeOptions(context.srcDir, context.componentsDir)
  const imageRoots = await imageSourceRoots(context.rootDir)
  const imagesDist = join(context.distDir, 'assets', 'images')
  const assetsDist = join(context.distDir, 'assets')
  await mkdir(imagesDist, { recursive: true })
  await assertUniqueImageNames(...imageRoots)
  // (Variant pruning intentionally removed — it raced with the cache check in processImages.
  // Stale variants are harmless: srcset only references widths the current sidecar reports.)
  imageMeta = await processImageSources(imageRoots, imagesDist, imageEncode)
  await pruneStaleImages(imagesDist, Object.keys(imageMeta))
  await processOgImage(await sourceOgImagePath(context.rootDir), assetsDist)
  tick('images', t)

  t = performance.now()
  const hasGlobalStyles = await copyAssetsTo(context.rootDir, context.distDir, {
    scroll: site.scroll ?? 'lenis',
  })
  await copyMediaFolderTo(context.rootDir, context.distDir)
  tick('assets', t)

  t = performance.now()
  const componentsCssDir = join(context.distDir, 'assets', 'css')
  const scriptBlocks: ScriptBlock[] = []

  const shellRaw = await readFile(context.shellFile, 'utf8')
  const { blocks: shellScripts } = extractShellHeadScripts(shellRaw)
  scriptBlocks.push(...shellScripts)

  // Compose the shell before routes so shell component use contributes to site-wide pruning.
  // Inject assets only after every static, content, and generated route has composed.
  const { html: strippedShell } = extractShellHeadScripts(shellRaw)
  const composedShellWithoutStyles = await composer.prepareShellSource(strippedShell)
  tick('shell-css', t)

  t = performance.now()
  const routeGraph = new RouteGraph({
    composer,
    instancesFor: (slug) => instancesByRoute.get(slug) ?? [],
    distDir: context.distDir,
    sourceRoot: context.rootDir,
  })

  for (const route of await discoverSourceRoutes({ srcDir: context.srcDir })) {
    const routeRaw = await readFile(route.sourcePath, 'utf8')
    const { html: routeHtml, data: routeData } = await extractTemplateData(routeRaw, {
      file: route.sourceRel,
      projectRoot: context.rootDir,
    })
    const owner = {
      slug: route.slug,
      kind: route.legacy ? 'legacy-static' as const : 'static' as const,
      source: route.sourceRel,
      outFile: route.outFile,
    }
    const { body: withoutScripts, scripts } = extractRouteTopScripts(routeHtml, route.sourceRel)
    scriptBlocks.push(...routeScriptBlocks(route.slug, scripts))

    const { html: body, css } = extractRouteStyleBlocks(withoutScripts)
    const cssAsset = await bundleRouteCss(route.slug, css, componentsCssDir)
    await routeGraph.compose(owner, body, {
      headLinks: cssAsset ? [routeCssLink(cssAsset)] : undefined,
      data: { site: site as unknown as TemplateValue, ...routeData },
    })
  }

  // Compile posts and configured content records via templates → dist/routes/...
  const contentRoutes = await compileContentFrom({ rootDir: context.rootDir, srcDir: context.srcDir })
  const contentByslug = new Map<string, ContentRoute>()
  for (const c of contentRoutes) {
    contentByslug.set(c.slug, c)
    await routeGraph.compose({ slug: c.slug, kind: 'content', source: c.source, outFile: c.routeFile }, c.body)
  }

  tick('routes', t)

  t = performance.now()
  const routeRecordsBeforeIndexes = routeGraph.records()
  const publicContentSlugs = new Set(routeRecordsBeforeIndexes.filter(isPublicRoute).map((record) => record.slug))

  // Auto-generate /insights/ index + /tags/{tag}/ + /tags/ index from public posts only.
  const posts = contentRoutes.filter((c) => c.collection === 'posts' && !c.draft && publicContentSlugs.has(c.slug))
  await autoGenerateIndexes(routeGraph, posts)
  assertImageEncodePlan(instancesByRoute, imageEncode)

  const usedComponents = new Set(componentUseCounts.keys())
  const usedCssBlocks = cssBlocks.filter(({ source }) => usedComponents.has(source.replace(/\.html$/i, '')))
  const componentsCssFile = await bundleComponentCss(usedCssBlocks, componentsCssDir)
  const composedShell = injectComponentStylesLink(
    injectGlobalStylesLink(composedShellWithoutStyles, hasGlobalStyles),
    componentsCssFile,
  )
  // Component lifecycle scripts register before route scripts, but only when the component
  // occurs in the fully composed site.
  scriptBlocks.splice(
    shellScripts.length,
    0,
    ...componentScriptBlocks(new Map(
      [...componentScripts].filter(([name]) => usedComponents.has(name)),
    )),
  )

  const routeRecords = routeGraph.records()
  await writeSitemap(context.distDir, site.url, routeRecords.filter(isPublicRoute))
  await writeRobots(context.distDir, site.url, site.robots?.groups)
  await writeFeeds(context.distDir, site, posts)

  await writeComponentsReadme(context.rootDir, templates, schemas)

  const routeExtrasBySlug = new Map(routeRecords.map((record) => [
    record.slug,
    routeSchemaExtras(record, schemas, contentByslug.get(record.slug), site),
  ]))
  const schemaExtrasBySlug = new Map([...routeExtrasBySlug].map(([slug, extras]) => [slug, extras.extraJsonLd]))

  await writeDiscovery(context.distDir, {
    site,
    routes: routeRecords,
    componentSchemas: schemas,
    componentUseCounts,
    contentByslug,
    routeExtrasBySlug,
  })
  tick('discovery', t)

  t = performance.now()
  const appJsFile = await writeAppJs(
    await sourceAppFile('app.ts', context.rootDir),
    join(context.distDir, 'assets', 'js'),
    scriptBlocks,
  )
  tick('app', t)

  t = performance.now()
  // Substitute hashed asset paths into the shell, then emit full static pages for direct public URLs.
  const shellWithApp = withAppJs(composedShell, appJsFile)
  await writeStaticRoutes(context.distDir, shellWithApp, routeGraph.composedRoutes(), routeRecords, schemaExtrasBySlug, site)

  await Bun.write(join(context.distDir, 'router.js'), Bun.file(await sourceRouterFile(context.rootDir)))
  await copyTree(await sourceRuntimeLibDir(context.rootDir), join(context.distDir, 'lib'))
  tick('static-output', t)

  const total = Math.round(performance.now() - t0)

  return {
    context,
    timings: { ...timings },
    totalMs: total,
    routes: routeGraph.slugs(),
    appJsFile,
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

async function writeErrorPage(err: unknown, context: BuildContext = createBuildContext()) {
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
:root { color-scheme: dark; --error-red:#ff3b30; --error-bg:#0a0a0a; --error-fg:#fafafa; --error-muted:#666; --error-card:#1c1c1c; }
* { box-sizing: border-box }
body { font: 15px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--error-bg); color: var(--error-fg); margin: 0; padding: 2rem; }
main { max-width: 60ch; margin: 4rem auto; }
.tag { display: inline-block; padding: .25em .5em; background: var(--error-red); color: white; font-weight: 600; border-radius: 4px; font-size: 12px; }
h1 { margin: .5em 0 1em; font-size: 1.5em; font-weight: 600; text-wrap: balance; }
.file { color: var(--error-muted); margin-bottom: 1.5em; }
.hint { padding: 1em; background: var(--error-card); border-left: 2px solid var(--error-red); border-radius: 4px; margin-bottom: 1.5em; }
.hint::before { content: 'hint: '; color: var(--error-muted); }
pre { background: var(--error-card); padding: 1em; border-radius: 4px; overflow-x: auto; font-size: 12px; color: var(--error-muted); }
.refresh { margin-top: 2em; color: var(--error-muted); font-size: 13px; }
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
    await mkdir(context.distDir, { recursive: true })
    await writeFile(join(context.distDir, '__build-error.html'), html)
  } catch {}
}

if (import.meta.main) {
  const context = createBuildContext()
  try {
    await build({ context })
    // Clear any previous error banner
    try { await rm(join(context.distDir, '__build-error.html'), { force: true }) } catch {}
  } catch (err) {
    await writeErrorPage(err, context)
    if (err instanceof BuildError) {
      console.error(err.toPretty())
    } else {
      console.error(err)
    }
    process.exit(1)
  }
}
