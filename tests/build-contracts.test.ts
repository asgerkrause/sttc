import { describe, expect, test } from 'bun:test'
import { outFileFromSlug, slugFromPageRel } from '../build/source-files'
import { slugifyTag } from '../build/content'
import { publicPathFromSlug, slugFromPath } from '../runtime/lib/paths.js'

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
})
