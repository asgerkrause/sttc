import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { BuildError } from '../build/errors'
import { destFontName, emitStyleFonts, fontFormat, fontPreloadsFromCss } from '../build/fonts'

describe('font emit', () => {
  test('keeps WOFF and WOFF2 names', () => {
    expect(destFontName('src/styles/sans.woff')).toBe('sans.woff')
    expect(destFontName('src/styles/sans.woff2')).toBe('sans.woff2')
    expect(fontFormat('sans.woff')).toBe('woff')
    expect(fontFormat('sans.woff2')).toBe('woff2')
  })

  test('preloads the first url() of each @font-face', () => {
    const css = `@font-face {
  font-family: "SNZ Sans";
  src: url("./sans.abc123.woff2") format("woff2"), url("./sans.abc123.woff") format("woff");
}
@font-face {
  font-family: "SNZ Mono";
  src: url("./mono.def456.woff") format("woff");
}`
    expect(fontPreloadsFromCss(css)).toEqual([
      '/assets/css/sans.abc123.woff2',
      '/assets/css/mono.def456.woff',
    ])
  })

  test('copies WOFF files with a content hash', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sttc-font-'))
    try {
      const stylesDir = join(dir, 'styles')
      const distCss = join(dir, 'dist')
      await mkdir(stylesDir, { recursive: true })
      await mkdir(distCss, { recursive: true })
      await writeFile(join(stylesDir, 'sans.woff'), 'woff-bytes')
      const emitted = await emitStyleFonts(stylesDir, distCss)
      const dest = emitted.get('sans.woff')
      expect(dest).toMatch(/^sans\.[a-f0-9]+\.woff$/)
      expect(await Bun.file(join(distCss, dest!)).text()).toBe('woff-bytes')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('rejects TTF sources', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sttc-font-'))
    try {
      const stylesDir = join(dir, 'styles')
      const distCss = join(dir, 'dist')
      await mkdir(stylesDir, { recursive: true })
      await mkdir(distCss, { recursive: true })
      await writeFile(join(stylesDir, 'sans.ttf'), 'not-woff')
      await expect(emitStyleFonts(stylesDir, distCss)).rejects.toBeInstanceOf(BuildError)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
