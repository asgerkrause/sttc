import { readFile } from 'fs/promises'
import { join } from 'path'
import { parseAttrs } from './tags'
import { BuildError } from './errors'

const ATTRS_GROUP = '(?:\\s+(?:[\\w-]+(?:="[^"]*")?))*'
const IMAGE_TAG_RE = new RegExp(`<Image(${ATTRS_GROUP})\\s*\\/?>`, 'g')
export const DEFAULT_IMAGE_MAX = 1200
export const DEFAULT_IMAGE_QUALITY = 82

export type ImageEncodeOptions = { max: number; quality: number }

export function imageNameFromSrc(value: string, file?: string) {
  const prefix = file ? `${file}: ` : ''
  if (!value) {
    throw new BuildError(`${prefix}Image requires src="name" (no extension)`, {
      hint: 'Use a logical image name without a path or extension, e.g. <Image src="hero" alt="..." />.',
    })
  }
  if (
    value === '.' || value === '..' ||
    value.includes('/') || value.includes('\\') ||
    /\.(jpe?g|png|webp)$/i.test(value) ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)
  ) {
    throw new BuildError(`${prefix}Image src must be a logical name without a path or extension (got "${value}")`, {
      hint: 'Use the image master basename only, e.g. src="hero" for src/images/hero.jpg.',
    })
  }
  return value
}

export function parsePositiveImageInteger(
  value: string | undefined,
  key: string,
  file?: string,
): number | undefined {
  if (value === undefined) return undefined
  const prefix = file ? `${file}: ` : ''
  if (!/^[1-9]\d*$/.test(value)) {
    throw new BuildError(`${prefix}Image ${key} must be a positive integer (got "${value}")`)
  }
  const number = Number(value)
  if (!Number.isSafeInteger(number)) {
    throw new BuildError(`${prefix}Image ${key} is too large (got "${value}")`)
  }
  return number
}

export function imageEncodeOptionsFromAttrs(
  attrs: Record<string, string>,
  file?: string,
): ImageEncodeOptions {
  const max = parsePositiveImageInteger(attrs.max, 'max', file) ?? DEFAULT_IMAGE_MAX
  const quality = parsePositiveImageInteger(attrs.quality, 'quality', file) ?? DEFAULT_IMAGE_QUALITY
  if (quality > 100) {
    const prefix = file ? `${file}: ` : ''
    throw new BuildError(`${prefix}Image quality must be 1–100`)
  }
  return { max, quality }
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
    // Component templates can forward attrs into Image. Their concrete values are
    // validated when the composed Image instance resolves.
    if (rawSrc.includes('{{')) continue
    const name = imageNameFromSrc(rawSrc, file)

    const { max, quality } = imageEncodeOptionsFromAttrs(attrs, file)
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
