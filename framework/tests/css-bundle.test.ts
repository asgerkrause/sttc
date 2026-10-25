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
  test('bundles both Craft copies while keeping SNZ fonts exclusive to dogfood', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sttc-craft-css-'))
    tempDirs.push(dir)
    const repoRoot = join(import.meta.dir, '..', '..')
    for (const [name, root] of [['dogfood', repoRoot], ['starter', join(repoRoot, 'templates', 'default')]]) {
      const distCss = join(dir, name)
      await mkdir(distCss)
      const stylesDir = join(root, 'src', 'styles')
      const result = await bundleProjectCss(join(root, 'src', 'styles.css'), stylesDir, distCss)
      if (!result) throw new Error(`${name} did not emit project CSS`)
      const css = await readFile(join(distCss, result.filename), 'utf8')
      expect(result.filename).toMatch(/^styles\.[a-f0-9]+\.css$/)
      expect(css).not.toContain('@import')
      expect(css).toContain('@layer reset, base, tokens, type, layout, grid, motion, utility, project;')
      expect(css).toContain('section > .c { container: container / inline-size; }')
      if (name === 'dogfood') {
        expect(css).toContain('font-family: "SNZ Sans";')
        expect(css).toContain('font-family: "SNZ Mono";')
        expect(result.fontPreloads).toHaveLength(2)
        for (const font of result.fontPreloads) {
          expect(font).toMatch(/^\/assets\/css\/(sans|mono)\.[a-f0-9]+\.woff2?$/)
          expect(await Bun.file(join(distCss, font.replace('/assets/css/', ''))).exists()).toBe(true)
        }
      } else {
        expect(css).toContain('color-scheme: light dark;')
        expect(css).not.toContain('color-scheme: light;')
        expect(css).toContain('system-ui')
        expect(css).not.toContain('@font-face')
        expect(result.fontPreloads).toEqual([])
        expect((await readdir(stylesDir, { recursive: true })).filter((file) => /\.(woff2?|ttf|otf)$/i.test(file))).toEqual([])
        expect(await readdir(distCss)).toEqual([result.filename])
      }
    }
  })

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

  test('flattens @import layer(), bare layer, supports(), and media conditions', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sttc-css-'))
    tempDirs.push(dir)
    const stylesDir = join(dir, 'src', 'styles')
    const distCss = join(dir, 'dist', 'assets', 'css')
    await mkdir(stylesDir, { recursive: true })
    await mkdir(distCss, { recursive: true })
    await writeFile(join(dir, 'src', 'styles.css'), '@import "/assets/css/global.css";\n')
    await writeFile(join(stylesDir, 'global.css'), `@import "./x.css" layer(vendor);
@import "./y.css" supports(display: grid) screen;
@import "./z.css" layer supports((display: grid) or (display: flex)) print and (min-width: 1px);
`)
    await writeFile(join(stylesDir, 'x.css'), 'x { color: red; }\n')
    await writeFile(join(stylesDir, 'y.css'), 'y { color: red; }\n')
    await writeFile(join(stylesDir, 'z.css'), 'z { color: red; }\n')

    const result = await bundleProjectCss(join(dir, 'src', 'styles.css'), stylesDir, distCss)
    const css = await readFile(join(distCss, result!.filename), 'utf8')
    expect(css).not.toContain('@import')
    expect(css).toContain('@layer vendor {\nx { color: red; }\n}')
    expect(css).toContain('@media screen {\n@supports (display: grid) {\ny { color: red; }\n}\n}')
    expect(css).toContain(
      '@media print and (min-width: 1px) {\n@supports ((display: grid) or (display: flex)) {\n@layer {\nz { color: red; }\n}\n}\n}',
    )
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
