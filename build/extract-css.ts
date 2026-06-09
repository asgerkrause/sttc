import { mkdir, readdir, readFile, rm, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { BuildError } from './errors'
import type { ComponentSchema } from './compose'
import { parseInlineSchema } from './component-meta'
import { assetHash } from './hash'

const STYLE_RE = /<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi
const STYLES_LINK = '<link rel="stylesheet" href="/assets/css/styles.css">'
const COMPONENTS_LINK = '<link rel="stylesheet" href="/assets/css/components.css">'
const COMPONENTS_MARKER = '<!-- @snz-components-css -->'

export type CssBlock = { source: string; css: string }

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

const COMPONENT_SCRIPT_RE =
  /<script(?![^>]*type=["']application\/ld\+json["'])(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi

/**
 * Extract lifecycle <script> blocks from a component template.
 * Each block becomes a per-instance mount function registered with the router runtime.
 */
export function extractComponentScripts(html: string): { html: string; scripts: string[] } {
  const scripts: string[] = []
  const cleaned = html.replace(COMPONENT_SCRIPT_RE, (_, body: string) => {
    const trimmed = body.trim()
    if (trimmed) scripts.push(trimmed)
    return ''
  }).replace(/\n{3,}/g, '\n\n').trim()
  return { html: cleaned, scripts }
}

export function rejectStyleInRoute(html: string, file: string) {
  if (/<style\b/i.test(html)) {
    throw new BuildError(`<style> not allowed in routes`, {
      file,
      hint: 'Use a component <style>, or scope rules with html[data-page="..."] in src/styles/styles.css.',
    })
  }
}

/** Read components: strip inline <style> + <script>, build template + schema + script registries. */
export async function prepareComponents(componentsDir: string): Promise<{
  cssBlocks: CssBlock[]
  templates: Map<string, string>
  schemas: Map<string, ComponentSchema>
  scripts: Map<string, string[]>
}> {
  const cssBlocks: CssBlock[] = []
  const templates = new Map<string, string>()
  const schemas = new Map<string, ComponentSchema>()
  const scripts = new Map<string, string[]>()
  let entries: string[]
  try {
    entries = await readdir(componentsDir)
  } catch {
    return { cssBlocks, templates, schemas, scripts }
  }

  const htmlFiles = entries.filter((f) => f.endsWith('.html')).sort()
  for (const file of htmlFiles) {
    const path = join(componentsDir, file)
    const raw = await readFile(path, 'utf8')
    const name = file.replace(/\.html$/i, '')
    // 1. Pull <script> first (so its content isn't swept by stripStyleBlocks comment regex)
    const { html: noScript, scripts: blocks } = extractComponentScripts(raw)
    if (blocks.length) scripts.set(name, blocks)
    // 2. Pull leading <!-- @desc / @attr / @schema --> comment (inline schema)
    const { html: noComment, schema } = parseInlineSchema(noScript)
    if (schema.description || (schema.attrs && Object.keys(schema.attrs).length) || schema.schema) {
      schemas.set(name, schema)
    }
    // 3. Pull <style>
    const { html, css } = stripStyleBlocks(noComment)
    templates.set(name, html)
    for (const chunk of css) cssBlocks.push({ source: file, css: chunk })
  }

  // Legacy .schema.json sidecars are no longer supported. If any exist, fail loudly so the
  // author knows to migrate them into an inline <!-- @desc … @attr … --> comment.
  const stragglers = entries.filter((f) => f.endsWith('.schema.json'))
  if (stragglers.length) {
    throw new BuildError(
      `Found legacy .schema.json sidecars: ${stragglers.join(', ')}`,
      {
        file: `src/components/`,
        hint: 'Move the schema into a <!-- @desc / @attr --> comment at the top of the matching .html file, then delete the .schema.json.',
      },
    )
  }

  return { cssBlocks, templates, schemas, scripts }
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
  const minified = minifyCss(parts.join('\n'))
  const hash = assetHash(minified)
  const filename = `components.${hash}.css`
  await mkdir(distCssDir, { recursive: true })
  await writeFile(join(distCssDir, filename), minified)
  return filename
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

  if (!html.includes(STYLES_LINK)) return html

  if (!html.match(/<link rel="stylesheet" href="\/assets\/css\/components/)) {
    return html.replace(STYLES_LINK, `${STYLES_LINK}\n${link}`)
  }

  return html
}
