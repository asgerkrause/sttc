import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { assetHash } from '../build/hash'
import { bundleComponentCss } from '../build/extract-css'
import { writeAppJs } from '../build/extract-js'

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
      expect(await readFile(join(dir, filename!), 'utf8')).toContain('.crd { color: red; }')
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
