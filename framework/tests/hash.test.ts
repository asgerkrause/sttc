import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { assetHash } from '../build/hash'
import { bundleComponentCss, bundleRouteCss, routeCssLayer } from '../build/extract-css'
import { writeAppJs } from '../build/extract-js'
import { pruneStaleImages } from '../build/images'

describe('asset hashing', () => {
  test('uses stable 8 character lowercase hex fingerprints', () => {
    const first = assetHash('same input')
    const second = assetHash('same input')
    const changed = assetHash('changed input')

    expect(first).toBe(second)
    expect(first).toMatch(/^[a-f0-9]{8}$/)
    expect(changed).toMatch(/^[a-f0-9]{8}$/)
    expect(changed).not.toBe(first)
  })

  test('keeps component css filename contract', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'snz-css-hash-'))
    try {
      const filename = await bundleComponentCss([{ source: 'Card.html', css: '.crd { color: red; }' }], dir)
      expect(filename).toMatch(/^components\.[a-f0-9]{8}\.css$/)
      const css = await readFile(join(dir, filename!), 'utf8')
      expect(css).toContain('@layer snz.components {')
      expect(css).toContain('.crd { color: red; }')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('keeps route css filename and layer contract', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'snz-route-css-hash-'))
    try {
      const asset = await bundleRouteCss('work/case', ['.hero { color: red; }'], dir)
      expect(asset?.filename).toMatch(/^work-case\.[a-f0-9]{8}\.css$/)
      expect(asset?.href).toMatch(/^\/assets\/css\/routes\/work-case\.[a-f0-9]{8}\.css$/)
      expect(asset?.layer).toBe('snz.pages.work-case')
      expect(routeCssLayer('404')).toBe('snz.pages.r-404')
      const css = await readFile(join(dir, 'routes', asset!.filename), 'utf8')
      expect(css).toContain('@layer snz.pages.work-case {')
      expect(css).toContain('.hero { color: red; }')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('prunes image output by sidecar, never by parsing a numeric name suffix', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'snz-image-prune-'))
    try {
      await mkdir(join(dir, '.meta'), { recursive: true })
      for (const file of ['photo-2024.webp', 'photo-2024-320.webp', 'photo-2024-640.webp', 'old.webp', 'old-320.webp']) {
        await writeFile(join(dir, file), 'webp')
      }
      await writeFile(join(dir, '.meta', 'photo-2024.json'), JSON.stringify({
        srcMtime: 1, max: 1600, quality: 80, width: 640, height: 480, sizes: [320],
        variants: [{ file: 'photo-2024-320.webp', width: 320 }],
      }))
      await writeFile(join(dir, '.meta', 'old.json'), '{}')

      await pruneStaleImages(dir, ['photo-2024'])
      await pruneStaleImages(dir, ['photo-2024'])

      expect((await readdir(dir)).sort()).toEqual(['.meta', 'photo-2024-320.webp', 'photo-2024.webp'])
      expect(await readdir(join(dir, '.meta'))).toEqual(['photo-2024.json'])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('keeps app js filename contract', async () => {
    const root = await mkdtemp(join(tmpdir(), 'snz-js-hash-'))
    try {
      const app = join(root, 'app.js')
      await Bun.write(app, 'window.__hashTest = true\n')
      const outDir = join(root, 'dist')
      await mkdir(outDir, { recursive: true })
      const filename = await writeAppJs(app, outDir, [])
      expect(filename).toMatch(/^app\.[a-f0-9]{8}\.js$/)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
