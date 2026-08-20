import { mkdir, readdir, rm, writeFile } from 'fs/promises'
import { basename, dirname, join, resolve } from 'path'
import { buildErrorAt, BuildError } from './errors'
import { destFontName, emitStyleFonts, fontFormat, fontMime, fontPreloadsFromCss } from './fonts'
import { assetHash } from './hash'

const STYLE_RE = /<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi
const COMPONENTS_LINK = '<link rel="stylesheet" href="/assets/css/components.css">'
const COMPONENTS_MARKER = '<!-- @snz-components-css -->'
const PUBLIC_CSS_PREFIX = '/assets/css/'
const IMPORT_RE = /@import\s+(?:url\(\s*)?(?:"([^"]+)"|'([^']+)'|([^;\s)]+))\s*\)?\s*([^;]*);/g
const URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi

export type CssBlock = { source: string; css: string }
export type RouteCssAsset = { href: string; filename: string; layer: string }
export type ProjectCssAsset = { filename: string; fontPreloads: string[] }

const COMPONENTS_LAYER = 'snz.components'
const PAGES_LAYER_ROOT = 'snz.pages'

function minifyCss(css: string) {
  // Keep nesting intact — aggressive minify broke nested selectors in component bundles.
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
}

export function stripStyleBlocks(html: string): { html: string; css: string[] } {
  const css: string[] = []
  const cleaned = html
    .replace(STYLE_RE, (_, content: string) => {
      const trimmed = content.trim()
      if (trimmed) css.push(trimmed)
      return ''
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { html: cleaned, css }
}

export { prepareComponents } from './components'

export function rejectStyleInRoute(html: string, file: string) {
  const match = html.match(/<style\b/i)
  if (match?.index !== undefined) {
    throw buildErrorAt(`<style> not allowed in routes`, html, match.index, {
      file,
      hint: 'Route <style> blocks are only allowed in authored static routes. Put content styles in component <style> blocks or src/styles.css.',
    })
  }
}

export function extractRouteStyleBlocks(html: string): { html: string; css: string[] } {
  return stripStyleBlocks(html)
}

function layerIdent(value: string) {
  const ident = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return /^[a-z_]/.test(ident) ? ident : `r-${ident || 'index'}`
}

export function routeCssLayer(slug: string) {
  return `${PAGES_LAYER_ROOT}.${layerIdent(slug === 'index' ? 'index' : slug)}`
}

function wrapLayer(layer: string, css: string) {
  return `@layer ${layer} {\n${css}\n}`
}

function resolveCssSpecifier(specifier: string, fromFile: string, stylesDir: string) {
  const spec = specifier.trim()
  if (!spec || /^(data:|https?:|\/\/)/i.test(spec)) return null
  if (spec.startsWith(PUBLIC_CSS_PREFIX)) return resolve(stylesDir, spec.slice(PUBLIC_CSS_PREFIX.length))
  if (spec.startsWith('/')) return null
  return resolve(dirname(fromFile), spec)
}

function rewriteLocalUrls(css: string, fromFile: string, stylesDir: string, destBySource: Map<string, string>) {
  return css.replace(URL_RE, (all, _quote: string, spec: string) => {
    const resolved = resolveCssSpecifier(spec, fromFile, stylesDir)
    if (!resolved) return all
    const dest = destBySource.get(resolved)
      ?? destBySource.get(basename(resolved))
      ?? destBySource.get(destFontName(resolved))
      ?? destFontName(resolved)
    return `url("./${dest}")`
  }).replace(
    /url\("\.\/([^"]+\.woff2?)"\)\s*format\(\s*["'](?:truetype|opentype)["']\s*\)/gi,
    (_all, file: string) => `url("./${file}") format("${fontFormat(file)}")`,
  )
}

async function flattenCss(
  entryFile: string,
  stylesDir: string,
  destBySource: Map<string, string>,
  stack: string[] = [],
): Promise<string> {
  const real = resolve(entryFile)
  if (stack.includes(real)) {
    throw new BuildError(`Circular CSS @import: ${[...stack, real].join(' -> ')}`, {
      file: entryFile,
      hint: 'Remove the cycle, or import the shared file from one parent only.',
    })
  }
  const source = await Bun.file(real).text().catch(() => null)
  if (source === null) {
    throw new BuildError(`Missing CSS import "${entryFile}"`, {
      file: stack.at(-1) ?? entryFile,
      hint: 'Point @import at a file under src/styles, or use @import "/assets/css/..." for that tree.',
    })
  }

  const nextStack = [...stack, real]
  const parts: string[] = []
  let cursor = 0
  const importRe = new RegExp(IMPORT_RE.source, IMPORT_RE.flags)
  for (const match of source.matchAll(importRe)) {
    const index = match.index ?? 0
    if (inCssComment(source, index)) continue
    parts.push(rewriteLocalUrls(source.slice(cursor, index), real, stylesDir, destBySource))
    const specifier = match[1] ?? match[2] ?? match[3] ?? ''
    const media = (match[4] ?? '').trim()
    const resolved = resolveCssSpecifier(specifier, real, stylesDir)
    if (!resolved) {
      parts.push(match[0])
    } else {
      const nested = await flattenCss(resolved, stylesDir, destBySource, nextStack)
      parts.push(media ? `@media ${media} {\n${nested}\n}` : nested)
    }
    cursor = index + match[0].length
  }
  parts.push(rewriteLocalUrls(source.slice(cursor), real, stylesDir, destBySource))
  return parts.join('\n')
}

function inCssComment(source: string, index: number) {
  const before = source.slice(0, index)
  const lastOpen = before.lastIndexOf('/*')
  if (lastOpen < 0) return false
  return before.indexOf('*/', lastOpen) < 0
}

export async function bundleProjectCss(
  stylesFile: string,
  stylesDir: string,
  distCssDir: string,
): Promise<ProjectCssAsset | null> {
  for (const entry of await readdir(distCssDir).catch(() => [])) {
    if (/^styles(\.[a-f0-9]+)?\.css$/i.test(entry)) {
      await rm(join(distCssDir, entry), { force: true })
    }
  }
  if (!(await Bun.file(stylesFile).exists())) return null

  await mkdir(distCssDir, { recursive: true })
  const fonts = await emitStyleFonts(stylesDir, distCssDir)
  const flattened = await flattenCss(stylesFile, stylesDir, fonts)
  const minified = minifyCss(flattened)
  const hash = assetHash(minified)
  const filename = `styles.${hash}.css`
  await writeFile(join(distCssDir, filename), minified)

  return { filename, fontPreloads: fontPreloadsFromCss(minified) }
}

export function injectFontPreloads(shellHtml: string, hrefs: string[]) {
  const stripped = shellHtml.replace(/\n?\s*<link rel="preload"[^>]*as="font"[^>]*>/g, '')
  if (!hrefs.length) return stripped
  const links = hrefs.map((href) =>
    `  <link rel="preload" href="${href}" as="font" type="${fontMime(href)}" crossorigin>`,
  ).join('\n')
  const styles = stripped.match(/\n\s*<link rel="stylesheet" href="\/assets\/css\/styles(\.[a-f0-9]+)?\.css">/)
  if (styles?.index !== undefined) {
    return `${stripped.slice(0, styles.index)}\n${links}${stripped.slice(styles.index)}`
  }
  return stripped.replace('</head>', `${links}\n</head>`)
}

/**
 * Bundles all component <style> blocks into dist/assets/css/components.{hash}.css.
 * Returns the hashed filename, or null when there are no styles to bundle.
 */
export async function bundleComponentCss(
  blocks: CssBlock[],
  distCssDir: string,
): Promise<string | null> {
  // Wipe any previous hashed components bundle so we don't leak stale files.
  for (const entry of await readdir(distCssDir).catch(() => [])) {
    if (/^components(\.[a-f0-9]+)?\.css$/i.test(entry)) {
      await rm(join(distCssDir, entry), { force: true })
    }
  }
  if (blocks.length === 0) return null

  const parts = blocks.map(({ source, css }) => `/* ${source} */\n${css}\n`)
  const layered = wrapLayer(COMPONENTS_LAYER, parts.join('\n'))
  const minified = minifyCss(layered)
  const hash = assetHash(minified)
  const filename = `components.${hash}.css`
  await mkdir(distCssDir, { recursive: true })
  await writeFile(join(distCssDir, filename), minified)
  return filename
}

export async function bundleRouteCss(
  slug: string,
  cssBlocks: string[],
  distCssDir: string,
): Promise<RouteCssAsset | null> {
  const css = cssBlocks.map((block) => block.trim()).filter(Boolean).join('\n\n')
  if (!css) return null

  const layer = routeCssLayer(slug)
  const minified = minifyCss(wrapLayer(layer, css))
  const hash = assetHash(minified)
  const base = layerIdent(slug === 'index' ? 'index' : slug)
  const filename = `${base}.${hash}.css`
  const routesDir = join(distCssDir, 'routes')
  await mkdir(routesDir, { recursive: true })
  await writeFile(join(routesDir, filename), minified)
  return { href: `/assets/css/routes/${filename}`, filename, layer }
}

export function routeCssLink(asset: RouteCssAsset) {
  return `<link rel="stylesheet" href="${asset.href}" data-snz-route-css>`
}

export function injectComponentStylesLink(shellHtml: string, hashedFilename: string | null) {
  let html = shellHtml.replace(COMPONENTS_LINK, '').replace(COMPONENTS_MARKER, '')
  html = html.replace(/<link rel="stylesheet" href="\/assets\/css\/components(\.[a-f0-9]+)?\.css">/g, '')

  if (!hashedFilename) {
    return html.replace(/\n{3,}/g, '\n\n')
  }

  const link = `  <link rel="stylesheet" href="/assets/css/${hashedFilename}">`

  if (shellHtml.includes(COMPONENTS_MARKER)) {
    return shellHtml.replace(COMPONENTS_MARKER, link)
  }

  if (html.match(/<link rel="stylesheet" href="\/assets\/css\/components/)) return html
  const stylesLink = html.match(/<link rel="stylesheet" href="\/assets\/css\/styles(\.[a-f0-9]+)?\.css">/)
  if (stylesLink) return html.replace(stylesLink[0], `${stylesLink[0]}\n${link}`)
  return html.replace('</head>', `${link}\n</head>`)
}

export function injectGlobalStylesLink(shellHtml: string, hashedFilename: string | null) {
  const withoutLink = shellHtml.replace(/\n?\s*<link rel="stylesheet" href="\/assets\/css\/styles(\.[a-f0-9]+)?\.css">/g, '')
  if (!hashedFilename) return withoutLink
  const link = `  <link rel="stylesheet" href="/assets/css/${hashedFilename}">`
  return withoutLink.replace('</head>', `${link}\n</head>`)
}
