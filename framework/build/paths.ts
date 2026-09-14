import { stat } from 'fs/promises'
import { join } from 'path'
import { BuildError } from './errors'

export const packageRoot = join(import.meta.dir, '..')
export const root = process.cwd()
export const src = join(root, 'src')
export const dist = join(root, 'dist')

export const componentsDir = join(src, 'components')
export const pagesDir = join(src, 'pages')

const packageRuntimeDir = join(packageRoot, 'runtime')

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
    templatesDir: join(sourceRoot, 'templates'),
    appFile: join(sourceRoot, 'app.js'),
    appTsFile: join(sourceRoot, 'app.ts'),
    stylesFile: join(sourceRoot, 'styles.css'),
    appDir: join(sourceRoot, 'app'),
    stylesDir: join(sourceRoot, 'styles'),
    imagesDir: join(sourceRoot, 'images'),
    videosDir: join(sourceRoot, 'videos'),
    filesDir: join(sourceRoot, 'files'),
  }
}

async function exists(path: string) {
  return stat(path).then(() => true).catch(() => false)
}

export function sourceAppDir(projectRoot = root) {
  return projectPaths(projectRoot).appDir
}

export function sourceStylesDir(projectRoot = root) {
  return projectPaths(projectRoot).stylesDir
}

export function sourceStylesFile(projectRoot = root) {
  return projectPaths(projectRoot).stylesFile
}

export function sourceImagesDir(projectRoot = root) {
  return projectPaths(projectRoot).imagesDir
}

export function sourceVideosDir(projectRoot = root) {
  return projectPaths(projectRoot).videosDir
}

export function sourceFilesDir(projectRoot = root) {
  return projectPaths(projectRoot).filesDir
}

export function selectAppEntry(paths: { appTs: string; appJs: string }, found: Set<string>) {
  const hasTs = found.has(paths.appTs)
  const hasJs = found.has(paths.appJs)
  if (hasTs && hasJs) {
    throw new BuildError('Multiple app entries found: use src/app.ts or src/app.js, not both.', {
      file: src,
      hint: 'Prefer src/app.ts. Delete src/app.js or merge its code into src/app.ts.',
    })
  }
  return hasJs ? paths.appJs : paths.appTs
}

export async function sourceAppFile(projectRoot = root) {
  const paths = projectPaths(projectRoot)
  const candidates = { appTs: paths.appTsFile, appJs: paths.appFile }
  const found = new Set<string>()
  for (const path of Object.values(candidates)) {
    if (await exists(path)) found.add(path)
  }
  return selectAppEntry(candidates, found)
}

export function sourceRouterFile() {
  return join(packageRuntimeDir, 'router.js')
}
