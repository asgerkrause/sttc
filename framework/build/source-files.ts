import { stat } from 'fs/promises'
import { join } from 'path'
import { pagesDir, routesDir } from './paths'

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

export async function sourceLastModified(path: string) {
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

export async function discoverSourceRoutes(): Promise<SourceRoute[]> {
  const routes = new Map<string, SourceRoute>()

  for (const rel of await scanHtml(routesDir)) {
    const slug = slugFromPageRel(rel)
    routes.set(slug, {
      slug,
      sourcePath: join(routesDir, rel),
      sourceRel: `src/routes/${rel}`,
      outFile: outFileFromSlug(slug),
      legacy: true,
    })
  }

  for (const rel of await scanHtml(pagesDir)) {
    const slug = slugFromPageRel(rel)
    routes.set(slug, {
      slug,
      sourcePath: join(pagesDir, rel),
      sourceRel: `src/pages/${rel}`,
      outFile: outFileFromSlug(slug),
      legacy: false,
    })
  }

  return [...routes.values()].sort((a, b) => a.slug.localeCompare(b.slug))
}
