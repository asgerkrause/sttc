import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { BuildError } from './errors'
import { assetHash } from './hash'

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
      hint: 'Move route logic into src/app/app.js and use snz.onPage(...) or the snz:page event.',
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

function generatedScriptCode(blocks: ScriptBlock[]) {
  let out = ''
  for (const block of blocks) {
    if (block.slug) {
      out += `\n// build: ${block.label}\nwindow.snz?.onPage('${block.slug}', () => {\n`
      out += `${indent(block.code)}\n});\n`
    } else {
      out += `\n// build: ${block.label}\n${block.code}\n`
    }
  }
  return out
}

function publicEnvDefines() {
  const define: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith('PUBLIC_')) continue
    define[`process.env.${key}`] = JSON.stringify(value ?? '')
    define[`import.meta.env.${key}`] = JSON.stringify(value ?? '')
  }
  return define
}

async function removeOldAppBundles(distAppDir: string, keep: string) {
  for (const entry of await (await import('fs/promises')).readdir(distAppDir).catch(() => [])) {
    if (/^app(\.[a-f0-9]+)?\.js$/i.test(entry) && entry !== keep) {
      await rm(join(distAppDir, entry), { force: true })
    }
  }
}

/**
 * Bundles the author app entry with Bun.build, appends extracted shell/component/route scripts,
 * writes dist/assets/js/app.{hash}.js, and returns the hashed filename.
 */
export async function writeAppJs(
  srcAppPath: string,
  distAppDir: string,
  blocks: ScriptBlock[],
): Promise<string> {
  await mkdir(distAppDir, { recursive: true })
  const tempDir = join(distAppDir, '.app-build')
  await rm(tempDir, { recursive: true, force: true })
  await mkdir(tempDir, { recursive: true })

  let appCode = ''
  if (await Bun.file(srcAppPath).exists()) {
    const result = await Bun.build({
      entrypoints: [srcAppPath],
      outdir: tempDir,
      target: 'browser',
      format: 'esm',
      splitting: false,
      sourcemap: 'none',
      define: publicEnvDefines(),
    })
    if (!result.success) {
      const message = result.logs.map((log) => log.message).filter(Boolean).join('\n') || `Could not bundle ${srcAppPath}`
      throw new BuildError(message, {
        file: srcAppPath,
        hint: 'Check imports from src/app.js or src/app.ts. Only PUBLIC_* env vars are inlined.',
      })
    }
    const output = result.outputs.find((file) => file.path.endsWith('.js'))
    appCode = output ? await output.text() : ''
  } else {
    appCode = await readFile(srcAppPath, 'utf8').catch(() => '')
  }

  let out = appCode.endsWith('\n') ? appCode : `${appCode}\n`
  out += generatedScriptCode(blocks)

  const hash = assetHash(out)
  const filename = `app.${hash}.js`
  await writeFile(join(distAppDir, filename), out)
  await removeOldAppBundles(distAppDir, filename)
  await rm(tempDir, { recursive: true, force: true })
  return filename
}
