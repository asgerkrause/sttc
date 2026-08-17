import { mkdir, readdir, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { buildErrorAt } from './errors'
import { assetHash } from './hash'

const STYLE_RE = /<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi
const STYLES_LINK = '<link rel="stylesheet" href="/assets/css/styles.css">'
const COMPONENTS_LINK = '<link rel="stylesheet" href="/assets/css/components.css">'
const COMPONENTS_MARKER = '<!-- @snz-components-css -->'

export type CssBlock = { source: string; css: string }
export type RouteCssAsset = { href: string; filename: string; layer: string }

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
  // Strip any previously injected hashed link
  html = html.replace(/<link rel="stylesheet" href="\/assets\/css\/components(\.[a-f0-9]+)?\.css">/g, '')

  if (!hashedFilename) {
    return html.replace(/\n{3,}/g, '\n\n')
  }

  const link = `  <link rel="stylesheet" href="/assets/css/${hashedFilename}">`

  if (shellHtml.includes(COMPONENTS_MARKER)) {
    return shellHtml.replace(COMPONENTS_MARKER, link)
  }

  if (html.match(/<link rel="stylesheet" href="\/assets\/css\/components/)) return html
  if (html.includes(STYLES_LINK)) return html.replace(STYLES_LINK, `${STYLES_LINK}\n${link}`)
  return html.replace('</head>', `${link}\n</head>`)
}

export function injectGlobalStylesLink(shellHtml: string, enabled: boolean) {
  const link = '  <link rel="stylesheet" href="/assets/css/styles.css">'
  const withoutLink = shellHtml.replace(/\n?\s*<link rel="stylesheet" href="\/assets\/css\/styles\.css">/g, '')
  if (!enabled) return withoutLink
  if (shellHtml.includes(STYLES_LINK)) return shellHtml
  return withoutLink.replace('</head>', `${link}\n</head>`)
}
