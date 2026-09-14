import { stat } from 'fs/promises'
import { join } from 'path'
import { src } from './paths'
import { BuildError } from './errors'

export type SourceRoute = {
  slug: string
  sourcePath: string
  sourceRel: string
  outFile: string
}

async function exists(path: string) {
  try { await stat(path); return true } catch { return false }
}

export function sourceDateEpoch(value = process.env.SOURCE_DATE_EPOCH) {
  if (value === undefined) return undefined
  if (!/^\d+$/.test(value)) {
    throw new BuildError('SOURCE_DATE_EPOCH must be a non-negative integer number of seconds')
  }
  const date = new Date(Number(value) * 1000)
  if (!Number.isFinite(date.valueOf())) {
    throw new BuildError('SOURCE_DATE_EPOCH is outside the supported date range')
  }
  return date
}

export function buildYear(value = process.env.SOURCE_DATE_EPOCH) {
  return String((sourceDateEpoch(value) ?? new Date()).getUTCFullYear())
}

function normalizeRel(path: string) {
  return path.replace(/\\/g, '/')
}

export function slugFromPageRel(relPath: string) {
  const clean = normalizeRel(relPath).replace(/\.html$/i, '')
  if (clean === 'index') return 'index'
  return clean.replace(/\/index$/i, '')
}

export function outFileFromSlug(slug: string) {
  return `${slug}.html`
}

async function scanHtml(dir: string) {
  if (!(await exists(dir))) return []
  const glob = new Bun.Glob('**/*.html')
  const files: string[] = []
  for await (const file of glob.scan({ cwd: dir, onlyFiles: true })) files.push(normalizeRel(file))
  return files.sort()
}

export async function discoverSourceRoutes(options: { srcDir?: string } = {}): Promise<SourceRoute[]> {
  const sourcePagesDir = join(options.srcDir ?? src, 'pages')
  const routes = (await scanHtml(sourcePagesDir)).map((rel) => {
    const slug = slugFromPageRel(rel)
    return {
      slug,
      sourcePath: join(sourcePagesDir, rel),
      sourceRel: `src/pages/${rel}`,
      outFile: outFileFromSlug(slug),
    }
  })
  return routes.sort((a, b) => a.slug.localeCompare(b.slug))
}
