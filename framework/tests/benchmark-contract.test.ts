import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { createFixture, validateFixture } from '../benchmarks/bench'

const tempDirs: string[] = []
afterEach(async () => {
  for (const dir of tempDirs.splice(0)) await rm(dir, { recursive: true, force: true })
})

describe('benchmark fixture contracts', () => {
  test('generates deterministic route and component workloads', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'snz-benchmark-'))
    tempDirs.push(dir)
    await createFixture(dir, 'routes', 10)

    expect(await Bun.file(join(dir, 'src/pages/index.html')).text()).toContain('<h1>Page 0</h1>')
    expect(await Bun.file(join(dir, 'src/pages/page-0009.html')).exists()).toBe(true)
    expect((await Bun.file(join(dir, 'src/pages/page-0001.html')).text()).match(/<Card /g)).toHaveLength(8)
  })

  test('rejects incomplete route output even when the manifest is complete', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'snz-benchmark-routes-invalid-'))
    tempDirs.push(dir)
    await createFixture(dir, 'routes', 2)
    await mkdir(join(dir, 'dist', 'routes'), { recursive: true })
    await writeFile(join(dir, 'dist', 'site.manifest.json'), JSON.stringify({ routes: [{ slug: 'index' }, { slug: 'page-0001' }] }))
    await writeFile(join(dir, 'dist', 'index.html'), '<h1>Page 0</h1>')
    for (const slug of ['index', 'page-0001']) {
      await writeFile(join(dir, 'dist', 'routes', `${slug}.json`), '{}')
      await writeFile(join(dir, 'dist', 'routes', `${slug}.md`), '# Page\n')
    }

    await expect(validateFixture(dir, 'routes', 2)).rejects.toThrow('public route inventory mismatch')
  })

  test('rejects same-sized media output with the wrong bytes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'snz-benchmark-media-invalid-'))
    tempDirs.push(dir)
    await createFixture(dir, 'media', 2)
    await mkdir(join(dir, 'dist', 'routes'), { recursive: true })
    await mkdir(join(dir, 'dist', 'assets', 'files'), { recursive: true })
    await writeFile(join(dir, 'dist', 'site.manifest.json'), JSON.stringify({ routes: [{ slug: 'index' }] }))
    await writeFile(join(dir, 'dist', 'index.html'), '<h1>Page 0</h1>')
    await writeFile(join(dir, 'dist', 'routes', 'index.json'), '{}')
    await writeFile(join(dir, 'dist', 'routes', 'index.md'), '# Page 0\n')
    await writeFile(join(dir, 'dist', 'assets', 'files', 'asset-0000.bin'), new Uint8Array(32 * 1024))
    await writeFile(join(dir, 'dist', 'assets', 'files', 'asset-0001.bin'), new Uint8Array(32 * 1024))

    await expect(validateFixture(dir, 'media', 2)).rejects.toThrow('invalid media output')
  })

  test('keeps category execution dry until peer installation is approved', async () => {
    const source = await Bun.file(join(import.meta.dir, '..', 'benchmarks', 'bench.ts')).text()
    expect(source).toContain("status: 'dry-run-only'")
    expect(source).not.toContain('bun add')
    expect(source).not.toContain('bun install')
  })
})
