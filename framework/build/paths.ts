import { stat } from 'fs/promises'
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
export const videosDir = join(src, 'videos')
export const filesDir = join(src, 'files')

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

export function projectPaths(projectRoot = root) {
  const sourceRoot = join(projectRoot, 'src')
  return {
    root: projectRoot,
    src: sourceRoot,
    dist: join(projectRoot, 'dist'),
    shellFile: join(sourceRoot, 'shell.html'),
    siteFile: join(sourceRoot, 'site.json'),
    componentsDir: join(sourceRoot, 'components'),
    pagesDir: join(sourceRoot, 'pages'),
    routesDir: join(sourceRoot, 'routes'),
    templatesDir: join(sourceRoot, 'templates'),
    appFile: join(sourceRoot, 'app.js'),
    appTsFile: join(sourceRoot, 'app.ts'),
    stylesFile: join(sourceRoot, 'styles.css'),
    appDir: join(sourceRoot, 'app'),
    stylesDir: join(sourceRoot, 'styles'),
    imagesDir: join(sourceRoot, 'images'),
    videosDir: join(sourceRoot, 'videos'),
    filesDir: join(sourceRoot, 'files'),
    legacyAssetsDir: join(sourceRoot, 'assets'),
    legacyAppDir: join(sourceRoot, 'assets', 'js'),
    legacyStylesDir: join(sourceRoot, 'assets', 'css'),
    legacyImagesDir: join(sourceRoot, 'assets', 'images'),
    runtimeDir: join(projectRoot, 'runtime'),
    legacyRuntimeRouter: join(projectRoot, 'router.js'),
    legacyRuntimeLib: join(projectRoot, 'lib'),
  }
}

async function exists(path: string) {
  return stat(path).then(() => true).catch(() => false)
}

export async function firstExisting(...paths: string[]) {
  for (const path of paths) {
    if (await exists(path)) return path
  }
  return paths[0]
}

export async function sourceAppDir(projectRoot = root) {
  const paths = projectPaths(projectRoot)
  return firstExisting(paths.appDir, paths.legacyAppDir)
}

export async function sourceStylesDir(projectRoot = root) {
  const paths = projectPaths(projectRoot)
  return firstExisting(paths.stylesDir, paths.legacyStylesDir)
}

export async function sourceStylesFile(projectRoot = root) {
  const paths = projectPaths(projectRoot)
  return firstExisting(paths.stylesFile, join(paths.stylesDir, 'styles.css'), join(paths.legacyStylesDir, 'styles.css'))
}

export async function sourceImagesDir(projectRoot = root) {
  const paths = projectPaths(projectRoot)
  return firstExisting(paths.imagesDir, paths.legacyImagesDir)
}

export async function sourceVideosDir(projectRoot = root) {
  return projectPaths(projectRoot).videosDir
}

export async function sourceFilesDir(projectRoot = root) {
  return projectPaths(projectRoot).filesDir
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

export async function sourceAppFile(name = 'app.ts', projectRoot = root) {
  const paths = projectPaths(projectRoot)
  if (name !== 'app.ts' && name !== 'app.js') return firstExisting(join(paths.appDir, name), join(paths.legacyAppDir, name))

  const legacyAppJs = await firstExisting(join(paths.appDir, 'app.js'), join(paths.legacyAppDir, 'app.js'))
  const candidates = { appTs: paths.appTsFile, appJs: paths.appFile, legacyAppJs }
  const found = new Set<string>()
  for (const path of Object.values(candidates)) {
    if (await exists(path)) found.add(path)
  }
  return selectAppEntry(candidates, found)
}

export async function sourceRouterFile(projectRoot = root) {
  const paths = projectPaths(projectRoot)
  return firstExisting(
    join(paths.runtimeDir, 'router.js'),
    paths.legacyRuntimeRouter,
    join(packageRuntimeDir, 'router.js'),
    legacyPackageRuntimeRouter,
  )
}

export async function sourceRuntimeLibDir(projectRoot = root) {
  const paths = projectPaths(projectRoot)
  return firstExisting(
    join(paths.runtimeDir, 'lib'),
    paths.legacyRuntimeLib,
    join(packageRuntimeDir, 'lib'),
    legacyPackageRuntimeLib,
  )
}
