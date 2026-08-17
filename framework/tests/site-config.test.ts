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
})
