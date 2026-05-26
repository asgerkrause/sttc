import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { BuildError } from './errors'

function shortHash(s: string) {
  return Bun.hash(s).toString(16).slice(0, 8)
}

const INLINE_SCRIPT_RE =
  /<script(?![^>]*\bsrc=)(?![^>]*type=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi

export type ScriptBlock = { label: string; slug?: string; code: string }

function indent(code: string, spaces = 2) {
  const pad = ' '.repeat(spaces)
  return code
    .split('\n')
    .map((line) => (line.trim() ? `${pad}${line}` : line))
    .join('\n')
}

export function extractInlineScripts(html: string): { html: string; scripts: string[] } {
  const scripts: string[] = []
  const cleaned = html.replace(INLINE_SCRIPT_RE, (_, body: string) => {
    const trimmed = body.trim()
    if (trimmed) scripts.push(trimmed)
    return ''
  })
  return { html: cleaned.replace(/\n{3,}/g, '\n\n').trim(), scripts }
}

const ROUTE_SCRIPT_RE =
  /^<script(?![^>]*\bsrc=)(?![^>]*type=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>\s*/i

/** Route: inline <script> only before SEO/body markup. */
export function extractRouteTopScripts(
  body: string,
  filename: string,
): { body: string; scripts: string[] } {
  let rest = body.trim()
  const scripts: string[] = []

  while (true) {
    rest = rest.trimStart()
    const script = rest.match(ROUTE_SCRIPT_RE)
    if (!script) break
    const code = script[1]?.trim()
    if (code) scripts.push(code)
    rest = rest.slice(script[0].length)
  }

  rejectScriptInRouteBody(rest, filename)
  return { body: rest, scripts }
}

function rejectScriptInRouteBody(html: string, file: string) {
  if (/<script\b/i.test(html)) {
    throw new BuildError(`<script> only allowed at top of route file`, {
      file,
      hint: 'Move route logic into src/assets/js/app.js and use snz.onPage(...) or the snz:page event.',
    })
  }
}

export function extractShellHeadScripts(raw: string): { html: string; blocks: ScriptBlock[] } {
  const headMatch = raw.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
  if (!headMatch) return { html: raw, blocks: [] }

  const headInner = headMatch[1]
  const { html: cleanedHead, scripts } = extractInlineScripts(headInner)
  const html = raw.replace(headMatch[0], `<head>\n${cleanedHead}\n</head>`)
  const blocks = scripts.map((code) => ({ label: 'shell', code }))
  return { html, blocks }
}

export function routeScriptBlocks(slug: string, scripts: string[]): ScriptBlock[] {
  return scripts.map((code) => ({ label: `route:${slug}`, slug, code }))
}

/**
 * Build per-component mount registrations.
 * Each component's <script> body is wrapped in `(el) => { ... }` and registered with snz._registerComponent.
 * Author writes against `el` (the instance root). Returning a function from the script is treated as cleanup.
 */
export function componentScriptBlocks(byComponent: Map<string, string[]>): ScriptBlock[] {
  const out: ScriptBlock[] = []
  for (const [name, blocks] of byComponent) {
    const body = blocks
      .map((b, i) => `// block ${i + 1}\n${b}`)
      .join('\n\n')
    const wrapped = `window.snz?._registerComponent('${name}', (el) => {\n${indent(body)}\n});`
    out.push({ label: `component:${name}`, code: wrapped })
  }
  return out
}

/**
 * Concatenates app.js + extracted script blocks, writes to dist/assets/js/app.{hash}.js,
 * returns the hashed filename. Old app.*.js bundles are removed.
 */
export async function writeAppJs(
  srcAppPath: string,
  distAppDir: string,
  blocks: ScriptBlock[],
): Promise<string> {
  let out = await readFile(srcAppPath, 'utf8').catch(() => '')
  if (!out.endsWith('\n')) out += '\n'

  for (const block of blocks) {
    if (block.slug) {
      out += `\n// build: ${block.label}\nwindow.snz?.onPage('${block.slug}', () => {\n`
      out += `${indent(block.code)}\n});\n`
    } else {
      out += `\n// build: ${block.label}\n${block.code}\n`
    }
  }

  const hash = shortHash(out)
  const filename = `app.${hash}.js`
  await mkdir(distAppDir, { recursive: true })
  // Remove previous hashed bundles
  for (const entry of await (await import('fs/promises')).readdir(distAppDir).catch(() => [])) {
    if (/^app(\.[a-f0-9]+)?\.js$/i.test(entry) && entry !== filename) {
      await rm(join(distAppDir, entry), { force: true })
    }
  }
  await writeFile(join(distAppDir, filename), out)
  return filename
}
