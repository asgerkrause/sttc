import { mkdir, readdir, readFile, realpath, stat, unlink, writeFile } from 'fs/promises'
import { basename, extname, isAbsolute, join, relative, resolve, sep } from 'path'
import { BuildError } from './errors'
import { escapeHtml } from './html'
import { CPU_CONCURRENCY, mapConcurrent } from './concurrency'
import {
  DEFAULT_IMAGE_MAX,
  DEFAULT_IMAGE_QUALITY,
  imageEncodeOptionsFromAttrs,
  imageNameFromSrc,
  parsePositiveImageInteger,
  type ImageEncodeOptions,
} from './scan-images'

const RASTER_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const FIT = { fit: 'inside' as const, withoutEnlargement: true }
const HUGE_DIMENSION = 4000
const DEFAULT_MEDIA_INPUT = 'src/images'

export type ImageVariant = { file: string; width: number }
export type ImageMeta = { width: number; height: number; sizes?: number[]; variants?: ImageVariant[] }
export type ImageSourceRoot = { dir: string; label: string }

type EncodeSidecar = {
  srcMtime: number
  srcHash?: string
  max: number
  quality: number
  width?: number
  height?: number
  sizes?: number[]
  variants?: ImageVariant[]
}

const RESPONSIVE_BREAKPOINTS = [320, 640, 1024]

function isLazy(attrs: Record<string, string>) {
  return (attrs.loading ?? 'lazy') !== 'eager'
}

function stripYamlScalar(value: string) {
  return value
    .replace(/\s+#.*$/, '')
    .trim()
    .replace(/^["']|["']$/g, '')
}

function parsePagesCmsMediaField(yaml: string, field: 'input' | 'output'): string[] {
  const values: string[] = []
  let inMedia = false

  for (const line of yaml.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const indent = line.match(/^\s*/)?.[0].length ?? 0
    if (indent === 0 && /^[\w-]+:/.test(trimmed)) {
      inMedia = trimmed.startsWith('media:')
      continue
    }
    if (!inMedia) continue

    const match = trimmed.match(new RegExp(`^${field}:\\s*(.+)$`))
    if (!match) continue
    const value = stripYamlScalar(match[1])
    if (value) values.push(value)
  }

  return [...new Set(values)]
}

function normalizePagesCmsMediaInput(input: string) {
  const rel = input.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/g, '')
  const parts = rel.split('/').filter(Boolean)
  if (
    !parts.length || rel.startsWith('/') || /^[A-Za-z]:\//.test(rel) ||
    parts.includes('..') || parts.includes('.')
  ) {
    throw new BuildError(`Invalid PagesCMS media.input "${input}"`, {
      file: '.pages.yml',
      hint: 'Use a safe repo-relative media path like src/images. Absolute paths and traversal are not allowed.',
    })
  }
  return parts.join('/')
}

export function parsePagesCmsMediaInputs(yaml: string): string[] {
  return parsePagesCmsMediaField(yaml, 'input').map(normalizePagesCmsMediaInput)
}

export function parsePagesCmsMediaOutputs(yaml: string): string[] {
  return parsePagesCmsMediaField(yaml, 'output')
}

export async function pagesCmsMediaInputs(projectRoot = process.cwd()): Promise<string[]> {
  const path = join(projectRoot, '.pages.yml')
  if (!(await Bun.file(path).exists())) return [DEFAULT_MEDIA_INPUT]
  const inputs = parsePagesCmsMediaInputs(await readFile(path, 'utf8'))
  return inputs.length ? inputs : [DEFAULT_MEDIA_INPUT]
}

function sourceRoot(projectRoot: string, rel: string, label = rel): ImageSourceRoot {
  return { dir: resolve(projectRoot, rel), label }
}

function uniqueRoots(roots: ImageSourceRoot[]) {
  const seen = new Set<string>()
  const out: ImageSourceRoot[] = []
  for (const root of roots) {
    const key = resolve(root.dir)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(root)
  }
  return out
}

export async function imageSourceRoots(projectRoot = process.cwd()): Promise<ImageSourceRoot[]> {
  const mediaRoots = (await pagesCmsMediaInputs(projectRoot)).map((input) =>
    sourceRoot(projectRoot, input, input),
  )
  const roots = uniqueRoots([
    sourceRoot(projectRoot, 'src/images'),
    sourceRoot(projectRoot, 'src/assets/images', 'src/assets/images (legacy)'),
    ...mediaRoots,
  ])
  const projectReal = await realpath(projectRoot)

  for (const root of roots) {
    let rootReal: string
    try {
      rootReal = await realpath(root.dir)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      throw error
    }
    const rel = relative(projectReal, rootReal)
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
      throw new BuildError(`Image source root escapes the project: ${root.label}`, {
        file: root.label,
        hint: 'Keep src/images and every PagesCMS media.input directory inside the project. Do not use an external symlink.',
      })
    }
  }

  return roots
}

export async function sourceOgImagePath(projectRoot = process.cwd()) {
  for (const rel of ['src/images/og.png', 'src/assets/images/og.png']) {
    const path = resolve(projectRoot, rel)
    if (await Bun.file(path).exists()) return path
  }
  return resolve(projectRoot, 'src/images/og.png')
}

export function assertImageApi() {
  if (typeof Bun.Image !== 'function') {
    throw new Error('Bun.Image requires Bun >= 1.4.0. Run: bun upgrade')
  }
}

function buildSrcset(name: string, sizes: number[] | undefined, variants: ImageVariant[] | undefined): string {
  const sources = variants?.length
    ? variants.map((variant) => ({ src: `/assets/images/${variant.file}`, width: variant.width }))
    : (sizes ?? []).map((width) => ({ src: `/assets/images/${name}-${width}.webp`, width }))
  const unique = [...new Map(sources.map((source) => [source.width, source])).values()]
  if (unique.length <= 1) return ''
  return unique.map((source) => `${source.src} ${source.width}w`).join(', ')
}

function escapeImageAttr(value: string) {
  return escapeHtml(value)
}

export function resolveImageAttrs(
  meta: Record<string, ImageMeta>,
  attrs: Record<string, string>,
): Record<string, string> {
  const name = imageNameFromSrc(attrs.src ?? '')
  imageEncodeOptionsFromAttrs(attrs)
  if (attrs.alt === undefined) {
    throw new BuildError(`Image "${name}" requires alt="…"`, {
      hint: 'Add useful alt text, or alt="" for decorative images.',
    })
  }

  const dims = meta[name]
  if (!dims) {
    throw new BuildError(`Image "${name}": add an image master named ${name}.{jpg,png,webp} and rebuild`, {
      hint: `Add src/images/${name}.jpg, .png, or .webp; or upload ${name} through PagesCMS media.input.`,
    })
  }

  const src = `/assets/images/${name}.webp`
  const alt = attrs.alt
  // Use the master's intrinsic dimensions as integer HTML attributes so the browser
  // reserves the correct aspect-ratio box pre-load. CSS still scales the rendered size
  // to fill the wrapper via .media img { width: 100%; height: 100% }.
  const width = String(parsePositiveImageInteger(attrs.width, 'width') ?? dims.width)
  const height = String(parsePositiveImageInteger(attrs.height, 'height') ?? dims.height)
  const aspectWidth = String(dims.width)
  const aspectHeight = String(dims.height)
  const loading = attrs.loading ?? 'lazy'
  const responsive = attrs.responsive !== 'false'
  const srcset = responsive ? buildSrcset(name, dims.sizes, dims.variants) : ''
  const sizesAttr = attrs.sizes ?? (srcset ? '100vw' : '')
  const srcsetMarkup = srcset ? ` srcset="${srcset}"` : ''
  const sizesMarkup = sizesAttr ? ` sizes="${escapeImageAttr(sizesAttr)}"` : ''

  const priority = isLazy(attrs) ? '' : ' fetchpriority="high"'
  return {
    src,
    alt,
    aspectWidth,
    aspectHeight,
    width,
    height,
    loading,
    imgTmp: '',
    imgMain: `<img src="${src}"${srcsetMarkup}${sizesMarkup} alt="${escapeImageAttr(alt)}" width="${escapeImageAttr(width)}" height="${escapeImageAttr(height)}" loading="${escapeImageAttr(loading)}" decoding="async"${priority} />`,
  }
}

function encodeOpts(name: string, options: Record<string, ImageEncodeOptions>): ImageEncodeOptions {
  return options[name] ?? { max: DEFAULT_IMAGE_MAX, quality: DEFAULT_IMAGE_QUALITY }
}

function sidecarPath(distDir: string, name: string) {
  return join(distDir, '.meta', `${name}.json`)
}

async function readSidecar(path: string): Promise<EncodeSidecar | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as EncodeSidecar
  } catch {
    return null
  }
}

function sourceHash(bytes: Uint8Array) {
  return new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
}

async function needsReencode(
  outPath: string,
  sidecar: string,
  max: number,
  quality: number,
  srcMtime: number,
  srcHash: string,
) {
  const prev = await readSidecar(sidecar)
  if (!prev || prev.srcMtime !== srcMtime || prev.srcHash !== srcHash || prev.max !== max || prev.quality !== quality) {
    return true
  }
  return !(await Bun.file(outPath).exists())
}

async function writeSidecar(sidecar: string, data: EncodeSidecar) {
  await mkdir(join(sidecar, '..'), { recursive: true })
  await writeFile(sidecar, JSON.stringify(data))
}

function warnHugeMaster(file: string, width: number, height: number) {
  if (width <= HUGE_DIMENSION && height <= HUGE_DIMENSION) return
  console.warn(
    `  images: large master ${relative(process.cwd(), file)} (${width}×${height}) — consider resizing source`,
  )
}

/**
 * Remove outputs no current master accounts for. Filenames are never parsed back into logical
 * names (a master called photo-2024 must survive); the sidecars say which files belong to whom.
 */
export async function pruneStaleImages(distDir: string, currentNames: Iterable<string>) {
  const names = new Set(currentNames)
  const keep = new Set<string>()
  for (const name of names) {
    keep.add(`${name}.webp`)
    for (const variant of (await readSidecar(sidecarPath(distDir, name)))?.variants ?? []) keep.add(variant.file)
  }
  const entries = await readdir(distDir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (!entry.isFile() || !/\.webp$/i.test(entry.name) || keep.has(entry.name)) continue
    await unlink(join(distDir, entry.name))
  }
  const sidecars = await readdir(join(distDir, '.meta')).catch(() => [])
  for (const file of sidecars) {
    if (file.endsWith('.json') && !names.has(basename(file, '.json'))) await unlink(join(distDir, '.meta', file))
  }
}

async function rasterFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await rasterFiles(path)))
      continue
    }
    if (!entry.isFile()) continue
    if (!RASTER_EXT.has(extname(entry.name).toLowerCase())) continue
    out.push(path)
  }
  return out
}

function normalizeImageRoot(root: string | ImageSourceRoot): ImageSourceRoot {
  return typeof root === 'string' ? { dir: root, label: relative(process.cwd(), root) || root } : root
}

export async function assertUniqueImageNames(...roots: Array<string | ImageSourceRoot>) {
  const sourceRoots = roots.map(normalizeImageRoot)
  const byName = new Map<string, string[]>()
  for (const root of sourceRoots) {
    for (const file of await rasterFiles(root.dir)) {
      const name = basename(file, extname(file))
      if (name === 'og') continue
      const files = byName.get(name) ?? []
      files.push(file)
      byName.set(name, files)
    }
  }

  const duplicates = [...byName.entries()].filter(([, files]) => files.length > 1)
  if (!duplicates.length) return

  const details = duplicates
    .map(([name, files]) => [
      `- ${name}`,
      ...files.map((file) => `  - ${relative(process.cwd(), file)}`),
    ].join('\n'))
    .join('\n')
  const scope = sourceRoots.map((root) => root.label).join(', ')

  throw new BuildError(
    `Duplicate image logical names found. Rename one master before build.\n${details}`,
    { hint: `Image logical names are file basenames. Keep each basename unique across ${scope}.` },
  )
}

export async function processImageSources(
  roots: ImageSourceRoot[],
  distDir: string,
  options: Record<string, ImageEncodeOptions> = {},
): Promise<Record<string, ImageMeta>> {
  const meta: Record<string, ImageMeta> = {}
  for (const root of roots) {
    Object.assign(meta, await processImages(root.dir, distDir, options))
  }
  return meta
}

/** One webp per master — Bun.Image resize + webp at build */
export async function processImages(
  srcDir: string,
  distDir: string,
  options: Record<string, ImageEncodeOptions> = {},
): Promise<Record<string, ImageMeta>> {
  assertImageApi()
  const meta: Record<string, ImageMeta> = {}
  try {
    if (!(await stat(srcDir)).isDirectory()) return meta
  } catch {
    return meta
  }

  await mkdir(distDir, { recursive: true })
  await mkdir(join(distDir, '.meta'), { recursive: true })

  const files = (await rasterFiles(srcDir)).filter((file) => basename(file, extname(file)) !== 'og')
  await mapConcurrent(files, CPU_CONCURRENCY, async (file) => {
    const name = basename(file, extname(file))
    const { max, quality } = encodeOpts(name, options)
    const out = join(distDir, `${name}.webp`)
    const sourceBytes = await readFile(file)
    const srcHash = sourceHash(sourceBytes)
    const srcMtime = (await stat(file)).mtimeMs
    const { width = 0, height = 0 } = await new Bun.Image(sourceBytes).metadata()
    warnHugeMaster(file, width, height)

    const canonicalEdge = Math.min(max, Math.max(width, height))
    const responsiveSizes = [...new Set(
      [...RESPONSIVE_BREAKPOINTS.filter((edge) => edge < canonicalEdge), canonicalEdge]
        .filter((edge) => edge > 0)
        .sort((a, b) => a - b),
    )]

    const sidecar = sidecarPath(distDir, name)
    const reencode = await needsReencode(out, sidecar, max, quality, srcMtime, srcHash)
    let sidecarData = await readSidecar(sidecar)
    const sizesChanged = !sidecarData?.sizes || sidecarData.sizes.join(',') !== responsiveSizes.join(',')
    const metadataMissing = !sidecarData?.width || !sidecarData?.height || !sidecarData?.variants
    let variantsMissing = false
    for (const w of responsiveSizes) {
      if (!(await Bun.file(join(distDir, `${name}-${w}.webp`)).exists())) { variantsMissing = true; break }
    }

    if (reencode || sizesChanged || variantsMissing || metadataMissing) {
      const canonicalBytes = await new Bun.Image(sourceBytes).resize(max, max, FIT).webp({ quality }).bytes()
      const canonicalMeta = await new Bun.Image(canonicalBytes).metadata()
      await Bun.write(out, canonicalBytes)

      const variants: ImageVariant[] = []
      for (const edge of responsiveSizes) {
        const filename = `${name}-${edge}.webp`
        const variantBytes = await new Bun.Image(sourceBytes).resize(edge, edge, FIT).webp({ quality }).bytes()
        const variantMeta = await new Bun.Image(variantBytes).metadata()
        await Bun.write(join(distDir, filename), variantBytes)
        variants.push({ file: filename, width: variantMeta.width ?? width })
      }
      sidecarData = {
        srcMtime,
        srcHash,
        max,
        quality,
        width: canonicalMeta.width ?? width,
        height: canonicalMeta.height ?? height,
        sizes: responsiveSizes,
        variants,
      }
      await writeSidecar(sidecar, sidecarData)
      console.log(`  image ${relative(srcDir, file)} → ${basename(out)} + ${responsiveSizes.length} sizes (q${quality})`)
    }

    meta[name] = {
      width: sidecarData?.width ?? width,
      height: sidecarData?.height ?? height,
      sizes: sidecarData?.sizes,
      variants: sidecarData?.variants,
    }
  })

  return meta
}

export async function processOgImage(srcPath: string, distDir: string) {
  assertImageApi()
  if (!(await Bun.file(srcPath).exists())) {
    console.warn(`images: no OG source at ${srcPath} — skipped`)
    return
  }

  const webp = join(distDir, 'og.webp')
  const png = join(distDir, 'og.png')
  const sourceBytes = await readFile(srcPath)
  const srcMtime = (await stat(srcPath)).mtimeMs
  const srcHash = sourceHash(sourceBytes)
  const previous = await readSidecar(sidecarPath(distDir, 'og'))
  const fresh =
    previous?.srcMtime === srcMtime &&
    previous.srcHash === srcHash &&
    (await Bun.file(webp).exists()) &&
    (await Bun.file(png).exists())
  if (fresh) return

  await mkdir(distDir, { recursive: true })
  await new Bun.Image(sourceBytes).resize(1200, 630, FIT).webp({ quality: 82 }).write(webp)
  await new Bun.Image(sourceBytes).resize(1200, 630, FIT).png({ compressionLevel: 6 }).write(png)
  await writeSidecar(sidecarPath(distDir, 'og'), { srcMtime, srcHash, max: 1200, quality: 82 })
  console.log('  image og → og.webp, og.png')
}
