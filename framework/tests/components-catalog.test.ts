import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { prepareComponents } from '../build/extract-css'
import { writeComponentsReadme } from '../build/docs'

async function generatedCatalog() {
  const dir = await mkdtemp(join(tmpdir(), 'sttc-catalog-'))
  const { templates, schemas } = await prepareComponents('src/components')
  await writeComponentsReadme(dir, templates, schemas)
  return {
    text: await readFile(join(dir, '.snz/components-catalog.md'), 'utf8'),
    cleanup: () => rm(dir, { recursive: true, force: true }),
  }
}

describe('components catalog', () => {
  test('rejects missing or non-rendering Image compiler bridges', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sttc-image-bridge-'))
    try {
      const components = join(dir, 'src', 'components')
      await mkdir(components, { recursive: true })
      for (const invalid of [
        '<figure><img alt="" /></figure>',
        '<figure><!-- {{imgMain}} --></figure>',
        '<figure data-image="{{imgMain}}"></figure>',
        '<script type="application/ld+json">{{imgMain}}</script><figure></figure>',
        '<textarea>{{imgMain}}</textarea>',
        '<template>{{imgMain}}</template>',
        '<figure>{{imgMain}}{{imgMain}}</figure>',
      ]) {
        await writeFile(join(components, 'Image.html'), invalid)
        await expect(prepareComponents(components, dir)).rejects.toThrow(
          'Image component must render the compiler image bridge exactly once as element content',
        )
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('always writes project-local state', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sttc-catalog-root-'))
    try {
      const { templates, schemas } = await prepareComponents('src/components')
      await writeComponentsReadme(dir, templates, schemas)
      expect(await Bun.file(join(dir, '.snz/components-catalog.md')).exists()).toBe(true)
      expect(await Bun.file(join(dir, 'framework/docs/components-catalog.md')).exists()).toBe(false)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('includes agent-readable contract fields and concrete examples', async () => {
    const catalog = await generatedCatalog()
    try {
      expect(catalog.text).toContain('### Contract')
      expect(catalog.text).toContain('### Accessibility notes')
      expect(catalog.text).toContain('Slots: `default`.')
      expect(catalog.text).toContain('<Image src="example" alt="Descriptive alt text" />')
      expect(catalog.text).toContain('<Video src="example">Content</Video>')
      expect(catalog.text).toContain('<Grid>Content</Grid>')
      expect(catalog.text).not.toContain('="..."')
    } finally {
      await catalog.cleanup()
    }
  })
})
