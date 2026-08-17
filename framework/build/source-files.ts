import { stat } from 'fs/promises'
import { join } from 'path'
import { routesDir } from './paths'
import { BuildError } from './errors'

export type SourceRoute = {
  slug: string
  sourcePath: string
  sourceRel: string
  outFile: string
  legacy: boolean
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

export async function sourceLastModified(path: string) {
  const reproducible = sourceDateEpoch()
  if (reproducible) return reproducible.toISOString()
  try {
    return (await stat(path)).mtime.toISOString()
  } catch {
    return undefined
  }
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
  const sourceRoot = options.srcDir ?? join(routesDir, '..')
  const sourceRoutesDir = join(sourceRoot, 'routes')
  const sourcePagesDir = join(sourceRoot, 'pages')
  const routes = new Map<string, SourceRoute>()

  for (const rel of await scanHtml(sourceRoutesDir)) {
    const slug = slugFromPageRel(rel)
    routes.set(slug, {
      slug,
      sourcePath: join(sourceRoutesDir, rel),
      sourceRel: `src/routes/${rel}`,
      outFile: outFileFromSlug(slug),
      legacy: true,
    })
  }

  for (const rel of await scanHtml(sourcePagesDir)) {
    const slug = slugFromPageRel(rel)
    routes.set(slug, {
      slug,
      sourcePath: join(sourcePagesDir, rel),
      sourceRel: `src/pages/${rel}`,
      outFile: outFileFromSlug(slug),
      legacy: false,
    })
  }

  return [...routes.values()].sort((a, b) => a.slug.localeCompare(b.slug))
}
