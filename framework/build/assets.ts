import { mkdir, readdir, rm, stat } from 'fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'path'
import { pagesCmsMediaInputs } from './images'
import { dist, root, sourceAppDir, sourceFilesDir, sourceImagesDir, sourceStylesDir, sourceStylesFile, sourceVideosDir } from './paths'

// Recursive copy implemented with sequential per-file writes. fs.cp(recursive: true) was
// observed to race with adjacent writes (image variants would vanish), so we walk + Bun.write.
// Skips files whose dest is already up to date — avoids reading src files unnecessarily,
// which on macOS causes fs.watch to fire spurious "change" events (atime touch).
export async function copyTree(
  srcDir: string,
  destDir: string,
  skip: (relPath: string) => boolean = () => false,
  baseRel = '',
) {
  let entries
  try { entries = await readdir(srcDir, { withFileTypes: true }) } catch { return }
  await mkdir(destDir, { recursive: true })
  for (const entry of entries) {
    if (entry.name === '.DS_Store' || entry.name === '.gitkeep') continue
    const relPath = baseRel ? join(baseRel, entry.name) : entry.name
    if (skip(relPath)) continue
    const srcPath = join(srcDir, entry.name)
    const destPath = join(destDir, entry.name)
    if (entry.isDirectory()) {
      await copyTree(srcPath, destPath, skip, relPath)
    } else if (entry.isFile()) {
      const srcStat = await stat(srcPath).catch(() => null)
      const destStat = await stat(destPath).catch(() => null)
      if (srcStat && destStat && destStat.mtimeMs >= srcStat.mtimeMs && destStat.size === srcStat.size) {
        continue
      }
      await Bun.write(destPath, Bun.file(srcPath))
    }
  }
}

export async function copyAssetsTo(
  projectRoot = root,
  outputDir = dist,
  options: { scroll?: 'lenis' | 'native' } = {},
) {
  const assetsDist = join(outputDir, 'assets')
  await mkdir(assetsDist, { recursive: true })

  // Wipe stale js bundles so old hashed app.*.js bundles don't linger.
  await rm(join(assetsDist, 'js'), { recursive: true, force: true })

  const cssDist = join(assetsDist, 'css')
  const jsDist = join(assetsDist, 'js')
  await mkdir(cssDist, { recursive: true })
  await mkdir(jsDist, { recursive: true })
  const stylesFile = await sourceStylesFile(projectRoot)
  const hasGlobalStyles = await Bun.file(stylesFile).exists()
  const nativeScroll = options.scroll === 'native'
  if (hasGlobalStyles) {
    await copyTree(await sourceStylesDir(projectRoot), cssDist, (name) => {
      const path = slashPath(name)
      if (name === 'styles.css') return true
      if (/\.(ttf|otf|woff2?)$/i.test(path)) return true
      if (path.endsWith('.css') && path !== 'lenis.css') return true
      return nativeScroll && path === 'lenis.css'
    })
    await pruneEmptyDirs(cssDist)
  }
  await copyTree(await sourceAppDir(projectRoot), jsDist, (name) => {
    const path = slashPath(name)
    return name === 'app.js'
      || name === 'app.ts'
      || (nativeScroll && (path === 'scroll.js' || path === 'vendor/lenis.min.js'))
  })
  const imagesDist = join(assetsDist, 'images')
  await mkdir(imagesDist, { recursive: true })
  await copyTree(await sourceImagesDir(projectRoot), imagesDist, (name) => !name.endsWith('.svg'))
  await copyTree(await sourceVideosDir(projectRoot), join(assetsDist, 'videos'))
  await copyTree(await sourceFilesDir(projectRoot), join(assetsDist, 'files'))
  return hasGlobalStyles
}

function slashPath(path: string) {
  return path.split(sep).join('/')
}

async function pruneEmptyDirs(dir: string) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const child = join(dir, entry.name)
    await pruneEmptyDirs(child)
    if ((await readdir(child)).length === 0) await rm(child, { recursive: true, force: true })
  }
}

export async function mediaInputCopyExclusions(projectRoot = root) {
  const mediaSrc = resolve(projectRoot, 'media')
  const exclusions: string[] = []
  for (const input of await pagesCmsMediaInputs(projectRoot)) {
    const rel = relative(mediaSrc, resolve(projectRoot, input))
    if (rel === '') {
      exclusions.push('')
      continue
    }
    if (rel.startsWith('..') || isAbsolute(rel)) continue
    exclusions.push(slashPath(rel))
  }
  return [...new Set(exclusions)]
}

export function shouldSkipMediaCopy(relPath: string, exclusions: string[]) {
  const rel = slashPath(relPath)
  return exclusions.some((exclusion) =>
    exclusion === '' || rel === exclusion || rel.startsWith(`${exclusion}/`),
  )
}

export async function copyMediaFolderTo(projectRoot = root, outputDir = dist) {
  // Configured media.input roots are source input for the optimizer, not public raw asset trees.
  // Other media folders can still be copied for non-image CMS files if added later.
  const mediaSrc = join(projectRoot, 'media')
  const exclusions = await mediaInputCopyExclusions(projectRoot)
  for (const exclusion of exclusions) {
    await rm(join(outputDir, 'media', exclusion), { recursive: true, force: true })
  }
  try {
    if ((await stat(mediaSrc)).isDirectory()) {
      await copyTree(mediaSrc, join(outputDir, 'media'), (relPath) => shouldSkipMediaCopy(relPath, exclusions))
    }
  } catch {
    /* no media folder */
  }
}


