import { readFile } from 'fs/promises'
import { join } from 'path'
import { parseAttrs } from './tags'
import { BuildError } from './errors'

const ATTRS_GROUP = '(?:\\s+(?:[\\w-]+(?:="[^"]*")?))*'
const IMAGE_TAG_RE = new RegExp(`<Image(${ATTRS_GROUP})\\s*\\/?>`, 'g')
const DEFAULT_MAX = 1200
const DEFAULT_QUALITY = 82

export type ImageEncodeOptions = { max: number; quality: number }

function parseIntAttr(value: string | undefined, key: string, file: string): number | undefined {
  if (value === undefined) return undefined
  const n = Number.parseInt(value, 10)
  if (!Number.isFinite(n) || n <= 0) {
    throw new BuildError(`${file}: Image ${key} must be a positive integer (got "${value}")`)
  }
  return n
}

function mergeOptions(
  map: Map<string, ImageEncodeOptions>,
  name: string,
  max: number,
  quality: number,
) {
  const prev = map.get(name)
  if (!prev) {
    map.set(name, { max, quality })
    return
  }
  map.set(name, {
    max: Math.max(prev.max, max),
    quality: Math.max(prev.quality, quality),
  })
}

function scanHtml(html: string, file: string, map: Map<string, ImageEncodeOptions>) {
  for (const m of html.matchAll(IMAGE_TAG_RE)) {
    const attrs = parseAttrs(m[1] ?? '')
    const rawSrc = attrs.src ?? ''
    const name = rawSrc.replace(/\.(jpe?g|png|webp)$/i, '')
    if (!name) throw new BuildError(`${file}: Image requires src="name"`)

    const max = parseIntAttr(attrs.max, 'max', file) ?? DEFAULT_MAX
    const quality = parseIntAttr(attrs.quality, 'quality', file) ?? DEFAULT_QUALITY
    if (quality > 100) throw new BuildError(`${file}: Image quality must be 1–100`)

    mergeOptions(map, name, max, quality)
  }
}

async function readIfExists(path: string) {
  if (!(await Bun.file(path).exists())) return null
  return readFile(path, 'utf8')
}

async function scanHtmlDir(dir: string, label: string, map: Map<string, ImageEncodeOptions>) {
  if (!(await Bun.file(dir).exists())) return
  const glob = new Bun.Glob('**/*.html')
  for await (const rel of glob.scan({ cwd: dir, onlyFiles: true })) {
    const html = await readFile(join(dir, rel), 'utf8')
    scanHtml(html, `${label}/${rel}`, map)
  }
}

/** Scan shell, routes, and component templates for <Image /> encode attrs. */
export async function scanImageEncodeOptions(
  srcDir: string,
  componentsDir: string,
): Promise<Record<string, ImageEncodeOptions>> {
  const map = new Map<string, ImageEncodeOptions>()

  const shell = await readIfExists(join(srcDir, 'shell.html'))
  if (shell) scanHtml(shell, 'src/shell.html', map)

  await scanHtmlDir(join(srcDir, 'routes'), 'src/routes', map)
  await scanHtmlDir(join(srcDir, 'pages'), 'src/pages', map)
  await scanHtmlDir(componentsDir, 'src/components', map)

  return Object.fromEntries(map)
}
