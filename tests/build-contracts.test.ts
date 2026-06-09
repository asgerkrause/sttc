import { describe, expect, test } from 'bun:test'
import { readFile } from 'fs/promises'
import { createComposer } from '../build/compose'
import { outFileFromSlug, slugFromPageRel } from '../build/source-files'
import { slugifyTag } from '../build/content'
import { publicPathFromSlug, slugFromPath } from '../runtime/lib/paths.js'

async function composeRoute(slug: string, fileHint: string) {
  const seoTemplate = await readFile('src/components/SEO.html', 'utf8')
  const composer = createComposer(new Map([['SEO', seoTemplate]]), new Map(), () => ({}))
  return composer.prepareRouteSource('<h1>Page</h1>', { slug, fileHint })
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
