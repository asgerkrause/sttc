import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { createComposer } from '../build/compose'
import { outFileFromSlug, slugFromPageRel } from '../build/source-files'
import { slugifyTag } from '../build/content'
import { BuildError } from '../build/errors'
import { mediaInputCopyExclusions, shouldSkipMediaCopy } from '../build/assets'
import { assertUniqueImageNames, imageSourceRoots, parsePagesCmsMediaInputs } from '../build/images'
import { publicPathFromSlug, slugFromPath } from '../runtime/lib/paths.js'

async function composeRoute(slug: string, fileHint: string) {
  const seoTemplate = await readFile('src/components/SEO.html', 'utf8')
  const composer = createComposer(new Map([['SEO', seoTemplate]]), new Map(), () => ({}))
  return composer.prepareRouteSource('<h1>Page</h1>', { slug, fileHint })
}

async function tempProject() {
  return mkdtemp(join(tmpdir(), 'snz-bp-media-'))
}

describe('build path contracts', () => {
  test('normalizes nested page files to route slugs', () => {
    expect(slugFromPageRel('index.html')).toBe('index')
    expect(slugFromPageRel('about.html')).toBe('about')
    expect(slugFromPageRel('blog/index.html')).toBe('blog')
    expect(slugFromPageRel('work/case.html')).toBe('work/case')
  })

  test('keeps output route file contract under dist/routes', () => {
    expect(outFileFromSlug('index')).toBe('index.html')
    expect(outFileFromSlug('blog')).toBe('blog.html')
    expect(outFileFromSlug('work/case')).toBe('work/case.html')
  })

  test('keeps public path and router slug contract aligned', () => {
    expect(publicPathFromSlug('index')).toBe('/')
    expect(publicPathFromSlug('blog')).toBe('/blog/')
    expect(publicPathFromSlug('work/case')).toBe('/work/case/')
    expect(slugFromPath('/')).toBe('index')
    expect(slugFromPath('/work/case/')).toBe('work/case')
  })

  test('slugifies generated tag routes predictably', () => {
    expect(slugifyTag('Bun Native')).toBe('bun-native')
    expect(slugifyTag('Ångström & SEO')).toBe('angstrom-seo')
  })

  test('parses PagesCMS media inputs from .pages.yml', () => {
    expect(parsePagesCmsMediaInputs(`
media:
  - name: images
    input: media/images
    output: /assets/images
  - name: portraits
    input: uploads/portraits # editor uploads
content:
  - name: posts
    path: content/posts
`)).toEqual(['media/images', 'uploads/portraits'])
  })

  test('uses PagesCMS media.input as image source root', async () => {
    const dir = await tempProject()
    try {
      await writeFile(join(dir, '.pages.yml'), `media:\n  - name: images\n    input: uploads/images\n    output: /assets/images\n`)
      const roots = await imageSourceRoots(dir)

      expect(roots.map((root) => root.label)).toContain('uploads/images')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('excludes media.input roots under media from raw media copy', async () => {
    const dir = await tempProject()
    try {
      await writeFile(join(dir, '.pages.yml'), `media:\n  - name: images\n    input: media/photos\n    output: /assets/images\n  - name: portraits\n    input: uploads/portraits\n    output: /assets/images\n`)
      const exclusions = await mediaInputCopyExclusions(dir)

      expect(exclusions).toEqual(['photos'])
      expect(shouldSkipMediaCopy('photos/team.png', exclusions)).toBe(true)
      expect(shouldSkipMediaCopy('photos/nested/team.png', exclusions)).toBe(true)
      expect(shouldSkipMediaCopy('downloads/file.pdf', exclusions)).toBe(false)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('allows unique logical image names across source roots', async () => {
    const dir = await tempProject()
    try {
      await mkdir(join(dir, 'src/images'), { recursive: true })
      await mkdir(join(dir, 'media/images'), { recursive: true })
      await writeFile(join(dir, 'src/images/hero.png'), 'src')
      await writeFile(join(dir, 'media/images/team.webp'), 'media')

      await expect(assertUniqueImageNames(...(await imageSourceRoots(dir)))).resolves.toBeUndefined()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('rejects duplicate logical image names across source roots', async () => {
    const dir = await tempProject()
    try {
      await mkdir(join(dir, 'src/images'), { recursive: true })
      await mkdir(join(dir, 'media/images'), { recursive: true })
      await writeFile(join(dir, 'src/images/hero.png'), 'src')
      await writeFile(join(dir, 'media/images/hero.webp'), 'media')

      try {
        await assertUniqueImageNames(...(await imageSourceRoots(dir)))
        throw new Error('expected duplicate image BuildError')
      } catch (err) {
        expect(err).toBeInstanceOf(BuildError)
        const build = err as BuildError
        expect(build.message).toContain('Duplicate image logical names found')
        expect(build.message).toContain('src/images/hero.png')
        expect(build.message).toContain('media/images/hero.webp')
        expect(build.hint).toContain('Keep each basename unique')
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('uses explicit route slug for default SEO instead of source file path', async () => {
    const html = await composeRoute('about', 'src/pages/about.html')

    expect(html).toContain('<link rel="canonical" href="https://example.com/about/">')
    expect(html).toContain('<meta property="og:url" content="https://example.com/about/">')
    expect(html).toContain('"url":"https://example.com/about/"')
    expect(html).not.toContain('/src/pages/about/')
  })

  test('keeps index route canonical at site root', async () => {
    const html = await composeRoute('index', 'src/pages/index.html')

    expect(html).toContain('<link rel="canonical" href="https://example.com/">')
    expect(html).toContain('<meta property="og:url" content="https://example.com/">')
    expect(html).not.toContain('/index/')
  })
})
