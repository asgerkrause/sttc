import { mkdir, readFile, rm, writeFile } from 'fs/promises'
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
  imageSourceRoots,
  processImageSources,
  processOgImage,
  pruneStaleImages,
  sourceOgImagePath,
  type ImageMeta,
} from './images'
import { scanImageEncodeOptions } from './scan-images'
import {
  componentsDir,
  dist,
  root,
  shellFile,
  siteFile,
  sourceAppFile,
  sourceRouterFile,
  sourceRuntimeLibDir,
  sourceStylesDir,
  src,
} from './paths'
import { writeRobots, writeSitemap, type SiteConfig } from './seo'
import { compileContent, type ContentRoute } from './content'
import { writeFeeds } from './feeds'
import { BuildError } from './errors'
import { copyAssets, copyMediaFolder, copyTree } from './assets'
import { autoGenerateIndexes } from './generated-routes'
import { runChecks, failOnReport } from './check'
import { writeDiscovery } from './discovery'
import type { ComposeInstance } from './compose'
import { writeComponentsReadme } from './docs'
import { discoverSourceRoutes } from './source-files'
import { RouteGraph } from './route-graph'

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
  const imageRoots = await imageSourceRoots(root)
  const imagesDist = join(dist, 'assets', 'images')
  const assetsDist = join(dist, 'assets')
  await mkdir(imagesDist, { recursive: true })
  await assertUniqueImageNames(...imageRoots)
  // (Variant pruning intentionally removed — it raced with the cache check in processImages.
  // Stale variants are harmless: srcset only references widths the current sidecar reports.)
  imageMeta = await processImageSources(imageRoots, imagesDist, imageEncode)
  await pruneStaleImages(imagesDist, Object.keys(imageMeta))
  await processOgImage(await sourceOgImagePath(root), assetsDist)
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
  const routeGraph = new RouteGraph({
    composer,
    instancesFor: (slug) => instancesByRoute.get(slug) ?? [],
  })

  for (const route of await discoverSourceRoutes()) {
    const routeRaw = await readFile(route.sourcePath, 'utf8')
    const owner = {
      slug: route.slug,
      kind: route.legacy ? 'legacy-static' as const : 'static' as const,
      source: route.sourceRel,
      outFile: route.outFile,
    }
    const { scripts } = extractRouteTopScripts(routeRaw, route.sourceRel)
    scriptBlocks.push(...routeScriptBlocks(route.slug, scripts))

    const { body } = extractRouteTopScripts(routeRaw, route.sourceRel)
    await routeGraph.compose(owner, body)
  }

  // Compile content/posts and content/pages via templates → dist/routes/...
  const contentRoutes = await compileContent()
  const contentByslug = new Map<string, ContentRoute>()
  for (const c of contentRoutes) {
    contentByslug.set(c.slug, c)
    await routeGraph.compose({ slug: c.slug, kind: 'content', source: c.source, outFile: c.routeFile }, c.body)
  }

  tick('routes', t)

  t = performance.now()
  const site = JSON.parse(await readFile(siteFile, 'utf8')) as SiteConfig

  // Auto-generate /insights/ index + /tags/{tag}/ + /tags/ index if not authored manually.
  const posts = contentRoutes.filter((c) => c.collection === 'posts' && !c.draft)
  await autoGenerateIndexes(routeGraph, posts)

  await writeSitemap(dist, site.url, routeGraph.slugs())
  await writeRobots(dist, site.url)
  await writeFeeds(dist, site, posts)

  await writeComponentsReadme(root, templates, schemas)

  await writeDiscovery(dist, {
    site,
    routes: routeGraph.records(),
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
  return s.replace(/[&<>\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
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
