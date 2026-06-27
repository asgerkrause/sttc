import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'fs/promises'
import { basename, extname, join, relative, resolve } from 'path'
import { BuildError } from './errors'
import type { ImageEncodeOptions } from './scan-images'

const RASTER_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const FIT = { fit: 'inside' as const, withoutEnlargement: true }
const DEFAULT_MAX = 1200
const DEFAULT_QUALITY = 82
const HUGE_DIMENSION = 4000
const DEFAULT_MEDIA_INPUT = 'src/images'

export type ImageMeta = { width: number; height: number; placeholder?: string; sizes?: number[] }
export type ImageSourceRoot = { dir: string; label: string }

type EncodeSidecar = { srcMtime: number; max: number; quality: number; placeholder?: string; sizes?: number[] }

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
  if (!parts.length || rel.startsWith('/') || parts.includes('..') || parts.includes('.')) {
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

  return uniqueRoots([
    sourceRoot(projectRoot, 'src/images'),
    sourceRoot(projectRoot, 'src/assets/images', 'src/assets/images (legacy)'),
    ...mediaRoots,
  ])
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
    throw new Error('Bun.Image requires Bun >= 1.3.14. Run: bun upgrade')
  }
}

function nameFromSrc(src: string) {
  return src.replace(/\.(jpe?g|png|webp)$/i, '')
}

function buildSrcset(name: string, sizes: number[] | undefined): string {
  if (!sizes || sizes.length <= 1) return ''
  return sizes.map((w) => `/assets/images/${name}-${w}.webp ${w}w`).join(', ')
}

export function resolveImageAttrs(
  meta: Record<string, ImageMeta>,
  attrs: Record<string, string>,
): Record<string, string> {
  const name = nameFromSrc(attrs.src ?? '')
  if (!name) {
    throw new BuildError('Image requires src="name" (no extension)', {
      hint: 'Use a logical image name without extension, e.g. <Image src="hero" alt="..." />.',
    })
  }
  if (!attrs.alt) {
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
  // to fill the wrapper via .img-w img { width: 100%; height: 100% }.
  const width = attrs.width ?? String(dims.width)
  const height = attrs.height ?? String(dims.height)
  const aspectWidth = String(dims.width)
  const aspectHeight = String(dims.height)
  const loading = attrs.loading ?? 'lazy'
  const responsive = attrs.responsive !== 'false'
  const srcset = responsive ? buildSrcset(name, dims.sizes) : ''
  const sizesAttr = attrs.sizes ?? (srcset ? '100vw' : '')
  const srcsetMarkup = srcset ? ` srcset="${srcset}"` : ''
  const sizesMarkup = sizesAttr ? ` sizes="${sizesAttr}"` : ''

  if (!isLazy(attrs)) {
    return {
      src,
      alt,
      aspectWidth,
      aspectHeight,
      width,
      height,
      loading,
      imgTmp: '',
      imgMain: `<img src="${src}"${srcsetMarkup}${sizesMarkup} alt="${alt}" width="${width}" height="${height}" loading="${loading}" decoding="async" fetchpriority="high" />`,
    }
  }

  const tmpSrc = dims.placeholder
  if (!tmpSrc) {
    throw new BuildError(`Image "${name}": lazy preview missing — rebuild`, {
      hint: 'Run the build again so the image sidecar can regenerate its lazy preview.',
    })
  }

  return {
    src,
    alt,
    aspectWidth,
    aspectHeight,
    width,
    height,
    loading,
    imgTmp: `<img class="img-tmp" src="${tmpSrc}" alt="" aria-hidden="true" decoding="sync" />`,
    imgMain: `<img src="${src}"${srcsetMarkup}${sizesMarkup} alt="${alt}" width="${width}" height="${height}" loading="${loading}" decoding="async" />`,
  }
}

function encodeOpts(name: string, options: Record<string, ImageEncodeOptions>): ImageEncodeOptions {
  return options[name] ?? { max: DEFAULT_MAX, quality: DEFAULT_QUALITY }
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

async function needsReencode(
  srcPath: string,
  outPath: string,
  sidecar: string,
  max: number,
  quality: number,
) {
  try {
    const srcMtime = (await stat(srcPath)).mtimeMs
    const prev = await readSidecar(sidecar)
    if (!prev || prev.srcMtime !== srcMtime || prev.max !== max || prev.quality !== quality) {
      return true
    }
    if (!prev.placeholder) return true
    return srcMtime > (await stat(outPath)).mtimeMs
  } catch {
    return true
  }
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
 * Removes stale sized variants from a previous build. Call ONCE before any processImages call.
 * Keeps the unprefixed canonical files (e.g. hero.webp); rewrites sized variants on demand.
 */
export async function pruneStaleVariants(distDir: string) {
  try {
    for (const entry of await readdir(distDir, { withFileTypes: true })) {
      if (entry.isFile() && /-\d+\.webp$/i.test(entry.name)) {
        await unlink(join(distDir, entry.name))
      }
    }
  } catch { /* dist dir not present yet */ }
}

export async function pruneStaleImages(distDir: string, currentNames: Iterable<string>) {
  const keep = new Set(currentNames)
  try {
    for (const entry of await readdir(distDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue
      const match = entry.name.match(/^(.+?)(?:-\d+)?\.webp$/i)
      if (!match) continue
      const name = match[1]
      if (name === 'og' || keep.has(name)) continue
      await unlink(join(distDir, entry.name))
      await unlink(sidecarPath(distDir, name)).catch(() => {})
    }
  } catch { /* dist dir not present yet */ }
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

  for (const file of await rasterFiles(srcDir)) {
    const name = basename(file, extname(file))
    if (name === 'og') continue

    const { max, quality } = encodeOpts(name, options)
    const out = join(distDir, `${name}.webp`)
    const { width = 0, height = 0 } = await Bun.file(file).image().metadata()
    warnHugeMaster(file, width, height)

    // Responsive sizes: 320, 640, 1024 + the requested max (deduped, capped at master width).
    const responsiveSizes = [...new Set(
      [...RESPONSIVE_BREAKPOINTS, max].filter((w) => w <= Math.max(width, max)).sort((a, b) => a - b),
    )]

    const sidecar = sidecarPath(distDir, name)
    const reencode = await needsReencode(file, out, sidecar, max, quality)
    let sidecarData = await readSidecar(sidecar)
    const sizesChanged = !sidecarData?.sizes || sidecarData.sizes.join(',') !== responsiveSizes.join(',')
    // If any expected variant file is missing on disk, force re-encode (covers cases where pruneStaleVariants
    // or external cleanup wiped them but the sidecar still claims they're cached).
    let variantsMissing = false
    for (const w of responsiveSizes) {
      if (!(await Bun.file(join(distDir, `${name}-${w}.webp`)).exists())) { variantsMissing = true; break }
    }

    if (reencode || sizesChanged || variantsMissing) {
      // Read the master once into memory.
      const sourceBytes = await readFile(file)
      // Use Bun.write (faster, atomic) for all encodes. Bun.file().image() chained to .write() seems
      // to interact with sibling files when the same source is consumed in rapid succession.
      await Bun.write(out, await new Bun.Image(sourceBytes).resize(max, max, FIT).webp({ quality }).bytes())
      for (const w of responsiveSizes) {
        const variant = join(distDir, `${name}-${w}.webp`)
        await Bun.write(variant, await new Bun.Image(sourceBytes).resize(w, w, FIT).webp({ quality }).bytes())
      }
      const srcMtime = (await stat(file)).mtimeMs
      const placeholder = await new Bun.Image(sourceBytes).placeholder()
      sidecarData = { srcMtime, max, quality, placeholder, sizes: responsiveSizes }
      await writeSidecar(sidecar, sidecarData)
      console.log(`  image ${relative(srcDir, file)} → ${basename(out)} + ${responsiveSizes.length} sizes (q${quality})`)
    } else if (!sidecarData?.placeholder) {
      const placeholder = await Bun.file(file).image().placeholder()
      sidecarData = { ...sidecarData!, placeholder }
      await writeSidecar(sidecar, sidecarData)
    }

    meta[name] = { width, height, placeholder: sidecarData?.placeholder, sizes: sidecarData?.sizes }
  }

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
  const srcMtime = (await stat(srcPath)).mtimeMs
  const fresh =
    (await readSidecar(sidecarPath(distDir, 'og')))?.srcMtime === srcMtime &&
    (await Bun.file(webp).exists()) &&
    (await Bun.file(png).exists())
  if (fresh) return

  await mkdir(distDir, { recursive: true })
  await Bun.file(srcPath).image().resize(1200, 630, FIT).webp({ quality: 82 }).write(webp)
  await Bun.file(srcPath).image().resize(1200, 630, FIT).png({ compressionLevel: 6 }).write(png)
  await writeSidecar(sidecarPath(distDir, 'og'), { srcMtime, max: 1200, quality: 82 })
  console.log('  image og → og.webp, og.png')
}
