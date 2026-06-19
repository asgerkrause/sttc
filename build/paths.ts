import { join } from 'path'
import { BuildError } from './errors'

export const packageRoot = join(import.meta.dir, '..')
export const root = process.cwd()
export const src = join(root, 'src')
export const dist = join(root, 'dist')

export const shellFile = join(src, 'shell.html')
export const siteFile = join(src, 'site.json')
export const componentsDir = join(src, 'components')
export const pagesDir = join(src, 'pages')
export const routesDir = join(src, 'routes')
export const templatesDir = join(src, 'templates')

export const appFile = join(src, 'app.js')
export const appTsFile = join(src, 'app.ts')
export const stylesFile = join(src, 'styles.css')
export const appDir = join(src, 'app')
export const stylesDir = join(src, 'styles')
export const imagesDir = join(src, 'images')

export const legacyAssetsDir = join(src, 'assets')
export const legacyAppDir = join(legacyAssetsDir, 'js')
export const legacyStylesDir = join(legacyAssetsDir, 'css')
export const legacyImagesDir = join(legacyAssetsDir, 'images')

export const runtimeDir = join(root, 'runtime')
export const packageRuntimeDir = join(packageRoot, 'runtime')
export const legacyRuntimeRouter = join(root, 'router.js')
export const legacyRuntimeLib = join(root, 'lib')
export const legacyPackageRuntimeRouter = join(packageRoot, 'router.js')
export const legacyPackageRuntimeLib = join(packageRoot, 'lib')

export const defaults = join(packageRoot, 'defaults')

async function exists(path: string) {
  return Bun.file(path).exists()
}

export async function firstExisting(...paths: string[]) {
  for (const path of paths) {
    if (await exists(path)) return path
  }
  return paths[0]
}

export async function sourceAppDir() {
  return firstExisting(appDir, legacyAppDir)
}

export async function sourceStylesDir() {
  return firstExisting(stylesDir, legacyStylesDir)
}

export async function sourceStylesFile() {
  return firstExisting(stylesFile, join(stylesDir, 'styles.css'), join(legacyStylesDir, 'styles.css'))
}

export async function sourceImagesDir() {
  return firstExisting(imagesDir, legacyImagesDir)
}

export function selectAppEntry(paths: { appTs: string; appJs: string; legacyAppJs: string }, found: Set<string>) {
  const hasTs = found.has(paths.appTs)
  const hasJs = found.has(paths.appJs)
  if (hasTs && hasJs) {
    throw new BuildError('Multiple app entries found: use src/app.ts or src/app.js, not both.', {
      file: src,
      hint: 'Prefer src/app.ts. Delete src/app.js or merge its code into src/app.ts.',
    })
  }
  if (hasTs) return paths.appTs
  if (hasJs) return paths.appJs
  return paths.legacyAppJs
}

export async function sourceAppFile(name = 'app.ts') {
  if (name !== 'app.ts' && name !== 'app.js') return firstExisting(join(appDir, name), join(legacyAppDir, name))

  const legacyAppJs = await firstExisting(join(appDir, 'app.js'), join(legacyAppDir, 'app.js'))
  const candidates = { appTs: appTsFile, appJs: appFile, legacyAppJs }
  const found = new Set<string>()
  for (const path of Object.values(candidates)) {
    if (await exists(path)) found.add(path)
  }
  return selectAppEntry(candidates, found)
}

export async function sourceRouterFile() {
  return firstExisting(
    join(runtimeDir, 'router.js'),
    legacyRuntimeRouter,
    join(packageRuntimeDir, 'router.js'),
    legacyPackageRuntimeRouter,
  )
}

export async function sourceRuntimeLibDir() {
  return firstExisting(
    join(runtimeDir, 'lib'),
    legacyRuntimeLib,
    join(packageRuntimeDir, 'lib'),
    legacyPackageRuntimeLib,
  )
}
