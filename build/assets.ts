import { mkdir, readdir, rm, stat } from 'fs/promises'
import { basename, join } from 'path'
import { dist, root, sourceAppDir, sourceAppFile, sourceStylesDir, sourceStylesFile } from './paths'

// Recursive copy implemented with sequential per-file writes. fs.cp(recursive: true) was
// observed to race with adjacent writes (image variants would vanish), so we walk + Bun.write.
// Skips files whose dest is already up to date — avoids reading src files unnecessarily,
// which on macOS causes fs.watch to fire spurious "change" events (atime touch).
export async function copyTree(srcDir: string, destDir: string, skip: (relPath: string) => boolean = () => false) {
  let entries
  try { entries = await readdir(srcDir, { withFileTypes: true }) } catch { return }
  await mkdir(destDir, { recursive: true })
  for (const entry of entries) {
    if (entry.name === '.DS_Store' || entry.name === '.gitkeep') continue
    if (skip(entry.name)) continue
    const srcPath = join(srcDir, entry.name)
    const destPath = join(destDir, entry.name)
    if (entry.isDirectory()) {
      await copyTree(srcPath, destPath, skip)
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

export async function copyAssets() {
  const assetsDist = join(dist, 'assets')
  await mkdir(assetsDist, { recursive: true })

  // Wipe stale js bundles so old hashed app.*.js bundles don't linger.
  await rm(join(assetsDist, 'js'), { recursive: true, force: true })

  const cssDist = join(assetsDist, 'css')
  const jsDist = join(assetsDist, 'js')
  await mkdir(cssDist, { recursive: true })
  await mkdir(jsDist, { recursive: true })
  await copyTree(await sourceStylesDir(), cssDist, (name) => name === 'styles.css')
  await Bun.write(join(cssDist, 'styles.css'), Bun.file(await sourceStylesFile()))
  await copyTree(await sourceAppDir(), jsDist, (name) => name === 'app.js')
  const appEntry = await sourceAppFile('app.js')
  await Bun.write(join(jsDist, 'app.js'), Bun.file(appEntry))
  if (basename(appEntry) === 'app.ts') await Bun.write(join(jsDist, 'app.ts'), Bun.file(appEntry))
  await mkdir(join(assetsDist, 'images'), { recursive: true })
}

export async function copyMediaFolder() {
  // media/images is source input for the optimizer, not a public raw asset tree.
  // Other media folders can still be copied for non-image CMS files if added later.
  await rm(join(dist, 'media', 'images'), { recursive: true, force: true })
  const mediaSrc = join(root, 'media')
  try {
    if ((await stat(mediaSrc)).isDirectory()) {
      await copyTree(mediaSrc, join(dist, 'media'), (name) => name === 'images')
    }
  } catch {
    /* no media folder */
  }
}
