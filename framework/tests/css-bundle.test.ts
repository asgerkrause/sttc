import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { BuildError } from '../build/errors'
import { bundleProjectCss } from '../build/extract-css'

const tempDirs: string[] = []

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) await rm(dir, { recursive: true, force: true })
})

describe('project CSS flatten', () => {
  test('inlines /assets/css imports, hashes WOFF urls, and emits one hashed file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sttc-css-'))
    tempDirs.push(dir)
    const stylesDir = join(dir, 'src', 'styles')
    const distCss = join(dir, 'dist', 'assets', 'css')
    await mkdir(join(stylesDir, 'layers'), { recursive: true })
    await mkdir(distCss, { recursive: true })

    await writeFile(join(stylesDir, 'sans.woff'), 'woff-bytes')

    await writeFile(join(dir, 'src', 'styles.css'), '@import "/assets/css/global.css";\n')
    await writeFile(join(stylesDir, 'global.css'), `@layer base, type;
@import "./layers/base.css";
@import "./layers/type.css";
`)
    await writeFile(join(stylesDir, 'layers', 'base.css'), `@layer base {
  html { color: canvastext; }
}
`)
    await writeFile(join(stylesDir, 'layers', 'type.css'), `@layer type {
  @font-face {
    font-family: "SNZ Sans";
    src: url("../sans.woff") format("woff");
  }
  header {
    > .c { display: flex; }
  }
}
`)

    const result = await bundleProjectCss(join(dir, 'src', 'styles.css'), stylesDir, distCss)
    expect(result?.filename).toMatch(/^styles\.[a-f0-9]+\.css$/)
    expect(result?.fontPreloads?.[0]).toMatch(/^\/assets\/css\/sans\.[a-f0-9]+\.woff$/)

    const css = await readFile(join(distCss, result!.filename), 'utf8')
    expect(css).not.toContain('@import')
    expect(css).toContain('@layer base, type;')
    expect(css).toContain('html { color: canvastext; }')
    expect(css).toContain('header {')
    expect(css).toContain('> .c { display: flex; }')
    expect(css).toMatch(/url\("\.\/sans\.[a-f0-9]+\.woff"\)/)
    expect(css).toContain('format("woff")')
    expect(css).not.toContain('.ttf')
    const fontFile = result!.fontPreloads[0]!.replace('/assets/css/', '')
    expect(await Bun.file(join(distCss, fontFile)).exists()).toBe(true)
    expect((await readdir(distCss)).filter((name) => name.endsWith('.css'))).toEqual([result!.filename])
  })

  test('fails when @font-face points at a missing WOFF', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sttc-css-'))
    tempDirs.push(dir)
    const stylesDir = join(dir, 'src', 'styles')
    const distCss = join(dir, 'dist', 'assets', 'css')
    await mkdir(stylesDir, { recursive: true })
    await mkdir(distCss, { recursive: true })
    await writeFile(join(dir, 'src', 'styles.css'), `@font-face {
  font-family: "Missing";
  src: url("./styles/ghost.woff") format("woff");
}
`)
    await expect(bundleProjectCss(join(dir, 'src', 'styles.css'), stylesDir, distCss)).rejects.toBeInstanceOf(BuildError)
  })

  test('refuses TTF sources', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sttc-css-'))
    tempDirs.push(dir)
    const stylesDir = join(dir, 'src', 'styles')
    const distCss = join(dir, 'dist', 'assets', 'css')
    await mkdir(stylesDir, { recursive: true })
    await mkdir(distCss, { recursive: true })
    await writeFile(join(stylesDir, 'sans.ttf'), 'not-woff')
    await writeFile(join(dir, 'src', 'styles.css'), 'html { color: canvastext; }\n')
    await expect(bundleProjectCss(join(dir, 'src', 'styles.css'), stylesDir, distCss)).rejects.toBeInstanceOf(BuildError)
  })
})
