import { readdir, rm } from 'fs/promises'
import { basename, extname, join } from 'path'
import { BuildError } from './errors'
import { assetHash } from './hash'

const FONT_EXT = /\.(woff2?)$/i
const SOURCE_FONT_EXT = /\.(ttf|otf|woff2?)$/i
const FORBIDDEN_EXT = /\.(ttf|otf)$/i

export function isFontFile(name: string) {
  return FONT_EXT.test(name)
}

export function destFontName(srcPath: string) {
  return basename(srcPath)
}

export function fontFormat(filename: string) {
  return extname(filename).toLowerCase() === '.woff2' ? 'woff2' : 'woff'
}

export function fontMime(filename: string) {
  return extname(filename).toLowerCase() === '.woff2' ? 'font/woff2' : 'font/woff'
}

export function fontPreloadsFromCss(css: string) {
  const hrefs: string[] = []
  const faces = css.match(/@font-face\s*\{[\s\S]*?\}/gi) ?? []
  for (const face of faces) {
    const urls = face.matchAll(/url\(\s*["']?\.\/([^"')]+)["']?\s*\)/gi)
    for (const match of urls) {
      const file = match[1]
      if (file && isFontFile(file)) hrefs.push(`/assets/css/${file}`)
    }
  }
  return [...new Set(hrefs)]
}

export async function collectStyleFonts(stylesDir: string) {
  const allowed: string[] = []
  const forbidden: string[] = []
  try {
    await readdir(stylesDir)
  } catch {
    return allowed
  }
  const glob = new Bun.Glob('**/*.{ttf,otf,woff,woff2}')
  for await (const rel of glob.scan({ cwd: stylesDir, onlyFiles: true })) {
    const full = join(stylesDir, rel)
    if (FORBIDDEN_EXT.test(rel)) forbidden.push(full)
    else if (FONT_EXT.test(rel)) allowed.push(full)
  }
  if (forbidden[0]) {
    throw new BuildError('TTF and OTF fonts are not emitted', {
      file: forbidden[0],
      hint: 'Commit WOFF or WOFF2 under src/styles and point @font-face at those files.',
    })
  }
  return allowed.sort()
}

export async function emitStyleFonts(stylesDir: string, distCssDir: string) {
  const emitted = new Map<string, string>()
  for (const entry of await readdir(distCssDir).catch(() => [])) {
    if (SOURCE_FONT_EXT.test(entry)) await rm(join(distCssDir, entry), { force: true })
  }
  for (const srcPath of await collectStyleFonts(stylesDir)) {
    const raw = new Uint8Array(await Bun.file(srcPath).arrayBuffer())
    const ext = extname(srcPath).toLowerCase()
    const destName = `${basename(srcPath, ext)}.${assetHash(raw)}${ext}`
    await Bun.write(join(distCssDir, destName), raw)
    emitted.set(srcPath, destName)
    emitted.set(basename(srcPath), destName)
  }
  return emitted
}
