import { describe, expect, test } from 'bun:test'
import { BuildError } from '../build/errors'
import { parseSiteConfig } from '../build/site-config'

describe('site configuration', () => {
  test('accepts brand, product, image, and robots facts', () => {
    const site = parseSiteConfig(JSON.stringify({
      name: 'Example',
      url: 'https://example.com',
      description: 'Useful site.',
      image: '/assets/og.webp',
      scroll: 'lenis',
      brand: { slogan: 'Useful by default' },
      product: { name: 'Platform', description: 'Useful product.', path: '/platform/' },
      robots: { groups: [{ userAgents: ['*'], allow: ['/'] }] },
    }))

    expect(site.product?.path).toBe('/platform/')
    expect(site.scroll).toBe('lenis')
    expect(site.robots?.groups?.[0]?.allow).toEqual(['/'])
  })

  test('reports missing product facts at src/site.json', () => {
    try {
      parseSiteConfig(`{
  "name": "Example",
  "url": "https://example.com",
  "description": "Useful site.",
  "product": { "name": "Platform", "path": "/platform/" }
}`)
      throw new Error('expected BuildError')
    } catch (error) {
      expect(error).toBeInstanceOf(BuildError)
      expect((error as BuildError).file).toBe('src/site.json')
      expect((error as BuildError).message).toContain('product.description')
    }
  })

  test('rejects unknown scroll modes', () => {
    expect(() => parseSiteConfig(JSON.stringify({
      name: 'Example',
      url: 'https://example.com',
      description: 'Useful site.',
      scroll: 'smooth',
    }))).toThrow('must be "lenis" or "native"')
  })

  test('rejects site URLs with paths', () => {
    expect(() => parseSiteConfig(JSON.stringify({
      name: 'Example',
      url: 'https://example.com/subpath',
      description: 'Useful site.',
    }))).toThrow('must be an HTTP(S) origin')
  })

  test('rejects invalid robots paths', () => {
    expect(() => parseSiteConfig(JSON.stringify({
      name: 'Example',
      url: 'https://example.com',
      description: 'Useful site.',
      robots: { groups: [{ userAgents: ['*'], disallow: ['private'] }] },
    }))).toThrow('robots disallow must contain root-relative paths')
  })

  test('accepts author, authors, and discovery facts', () => {
    const site = parseSiteConfig(JSON.stringify({
      name: 'Example',
      url: 'https://example.com',
      description: 'Useful site.',
      author: { name: 'Ada Lovelace', url: '/about/', jobTitle: 'Writer', image: '/ada.webp' },
      authors: [{
        name: 'Grace Hopper',
        sameAs: ['https://en.wikipedia.org/wiki/Grace_Hopper'],
      }],
      discovery: { featured: ['index', 'insights/hello'], notes: 'Start with the platform page.' },
    }))

    expect(site.author?.name).toBe('Ada Lovelace')
    expect(site.authors?.[0]?.sameAs).toEqual(['https://en.wikipedia.org/wiki/Grace_Hopper'])
    expect(site.discovery?.featured).toEqual(['index', 'insights/hello'])
    expect(site.discovery?.notes).toBe('Start with the platform page.')
  })

  test('rejects author without a name', () => {
    expect(() => parseSiteConfig(JSON.stringify({
      name: 'Example',
      url: 'https://example.com',
      description: 'Useful site.',
      author: { url: '/about/' },
    }))).toThrow('author.name')
  })

  test('rejects authors sameAs that is not an HTTP(S) URL', () => {
    expect(() => parseSiteConfig(JSON.stringify({
      name: 'Example',
      url: 'https://example.com',
      description: 'Useful site.',
      authors: [{ name: 'Ada Lovelace', sameAs: ['linkedin.com/in/ada'] }],
    }))).toThrow('sameAs')
  })

  test('rejects discovery featured paths that are not slugs', () => {
    expect(() => parseSiteConfig(JSON.stringify({
      name: 'Example',
      url: 'https://example.com',
      description: 'Useful site.',
      discovery: { featured: ['/about'] },
    }))).toThrow('discovery.featured')

    expect(() => parseSiteConfig(JSON.stringify({
      name: 'Example',
      url: 'https://example.com',
      description: 'Useful site.',
      discovery: { featured: ['about.html'] },
    }))).toThrow('discovery.featured')
  })

  test('rejects discovery notes with markdown headings', () => {
    try {
      parseSiteConfig(JSON.stringify({
        name: 'Example',
        url: 'https://example.com',
        description: 'Useful site.',
        discovery: { notes: 'Hello\n## Secret heading' },
      }))
      throw new Error('expected BuildError')
    } catch (error) {
      expect(error).toBeInstanceOf(BuildError)
      expect((error as BuildError).message).toContain('discovery.notes')
      expect((error as BuildError).hint).toContain('llms.txt v2')
    }
  })
})
