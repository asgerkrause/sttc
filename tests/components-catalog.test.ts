import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { prepareComponents } from '../build/extract-css'
import { writeComponentsReadme } from '../build/docs'

describe('components catalog', () => {
  test('stays generated from component schemas', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'snz-bp-catalog-'))
    try {
      const { templates, schemas } = await prepareComponents('src/components')

      await writeComponentsReadme(dir, templates, schemas)

      const generated = await readFile(join(dir, 'docs/components-catalog.md'), 'utf8')
      const committed = await readFile('docs/components-catalog.md', 'utf8')
      expect(generated).toBe(committed)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('includes agent-readable contract fields and concrete examples', async () => {
    const catalog = await readFile('docs/components-catalog.md', 'utf8')

    expect(catalog).toContain('### Contract')
    expect(catalog).toContain('### Variants / enums')
    expect(catalog).toContain('### Accessibility notes')
    expect(catalog).toContain('Slots: `default`.')
    expect(catalog).toContain('<Image src="hero" alt="Product interface" max="1200" />')
    expect(catalog).toContain('<Embed src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Product demo" />')
    expect(catalog).not.toContain('="..."')
  })
})
