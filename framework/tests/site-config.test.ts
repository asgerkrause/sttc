import { describe, expect, test } from 'bun:test'
import { BuildError } from '../build/errors'
import type { JsonObject } from '../build/json'
import { parseSiteConfig } from '../build/site-config'

describe('site configuration', () => {
  test('accepts brand, product, image, and robots facts', () => {
    const site = parseSiteConfig(
      JSON.stringify({
        name: 'Example',
        url: 'https://example.com',
        description: 'Useful site.',
        image: '/assets/og.webp',
        scroll: 'lenis',
        brand: { slogan: 'Useful by default' },
        product: { name: 'Platform', description: 'Useful product.', path: '/platform/' },
        robots: { groups: [{ userAgents: ['*'], allow: ['/'] }] },
      }),
    )

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
    expect(() =>
      parseSiteConfig(
        JSON.stringify({
          name: 'Example',
          url: 'https://example.com',
          description: 'Useful site.',
          scroll: 'smooth',
        }),
      ),
    ).toThrow('must be "lenis" or "native"')
  })

  test('rejects site URLs with paths', () => {
    expect(() =>
      parseSiteConfig(
        JSON.stringify({
          name: 'Example',
          url: 'https://example.com/subpath',
          description: 'Useful site.',
        }),
      ),
    ).toThrow('must be an HTTP(S) origin')
  })

  test('rejects invalid robots paths', () => {
    expect(() =>
      parseSiteConfig(
        JSON.stringify({
          name: 'Example',
          url: 'https://example.com',
          description: 'Useful site.',
          robots: { groups: [{ userAgents: ['*'], disallow: ['private'] }] },
        }),
      ),
    ).toThrow('robots disallow must contain root-relative paths')
  })

  test('accepts author, authors, and discovery facts', () => {
    const site = parseSiteConfig(
      JSON.stringify({
        name: 'Example',
        url: 'https://example.com',
        description: 'Useful site.',
        author: { name: 'Ada Lovelace', url: '/about/', jobTitle: 'Writer', image: '/ada.webp' },
        authors: [
          {
            name: 'Grace Hopper',
            sameAs: ['https://en.wikipedia.org/wiki/Grace_Hopper'],
          },
        ],
        discovery: { featured: ['index', 'insights/hello'], notes: 'Start with the platform page.' },
      }),
    )

    expect(site.author?.name).toBe('Ada Lovelace')
    expect(site.authors?.[0]?.sameAs).toEqual(['https://en.wikipedia.org/wiki/Grace_Hopper'])
    expect(site.discovery?.featured).toEqual(['index', 'insights/hello'])
    expect(site.discovery?.notes).toBe('Start with the platform page.')
  })

  test('rejects author without a name', () => {
    expect(() =>
      parseSiteConfig(
        JSON.stringify({
          name: 'Example',
          url: 'https://example.com',
          description: 'Useful site.',
          author: { url: '/about/' },
        }),
      ),
    ).toThrow('author.name')
  })

  test('rejects authors sameAs that is not an HTTP(S) URL', () => {
    expect(() =>
      parseSiteConfig(
        JSON.stringify({
          name: 'Example',
          url: 'https://example.com',
          description: 'Useful site.',
          authors: [{ name: 'Ada Lovelace', sameAs: ['linkedin.com/in/ada'] }],
        }),
      ),
    ).toThrow('sameAs')
  })

  test('rejects discovery featured paths that are not slugs', () => {
    expect(() =>
      parseSiteConfig(
        JSON.stringify({
          name: 'Example',
          url: 'https://example.com',
          description: 'Useful site.',
          discovery: { featured: ['/about'] },
        }),
      ),
    ).toThrow('discovery.featured')

    expect(() =>
      parseSiteConfig(
        JSON.stringify({
          name: 'Example',
          url: 'https://example.com',
          description: 'Useful site.',
          discovery: { featured: ['about.html'] },
        }),
      ),
    ).toThrow('discovery.featured')
  })

  test('rejects discovery notes with markdown headings', () => {
    try {
      parseSiteConfig(
        JSON.stringify({
          name: 'Example',
          url: 'https://example.com',
          description: 'Useful site.',
          discovery: { notes: 'Hello\n## Secret heading' },
        }),
      )
      throw new Error('expected BuildError')
    } catch (error) {
      expect(error).toBeInstanceOf(BuildError)
      expect((error as BuildError).message).toContain('discovery.notes')
      expect((error as BuildError).hint).toContain('llms.txt v2')
    }
  })

  const site = (extra: JsonObject) =>
    JSON.stringify({ name: 'Example', url: 'https://example.com', description: 'Useful site.', ...extra }, null, 2)

  test('rejects unknown and misspelled keys at the line of the key', () => {
    expect(() => parseSiteConfig(site({ descripton: 'Typo.' }))).toThrow(
      'site.json "descripton" is not a known setting',
    )
    expect(() => parseSiteConfig(site({ vercel: { analytics: true } }))).toThrow('"vercel" is not a known setting')
    expect(() => parseSiteConfig(site({ organization: { name: 'O', phone: '1' } }))).toThrow(
      '"organization.phone" is not a known setting',
    )
    expect(() => parseSiteConfig(site({ address: { street: 's' } }))).toThrow('"address.street" is not a known setting')
    try {
      parseSiteConfig(site({ descripton: 'Typo.' }))
    } catch (error) {
      if (!(error instanceof BuildError)) throw error
      expect(error.line).toBe(5)
      expect(error.hint).toContain('Known keys: name, url, description')
    }
  })

  test('validates organization, brand, contact, address, sameAs, and topics', () => {
    expect(() => parseSiteConfig(site({ organization: 'O' }))).toThrow('site.json "organization" must be an object')
    expect(() => parseSiteConfig(site({ organization: { sameAs: ['nope'] } }))).toThrow(
      'site.json "organization.sameAs" must be HTTP(S) URLs',
    )
    expect(() => parseSiteConfig(site({ organization: { contact: { email: 1 } } }))).toThrow(
      'site.json "organization.contact.email" must be a string',
    )
    expect(() => parseSiteConfig(site({ brand: { slogan: [] } }))).toThrow('site.json "brand.slogan" must be a string')
    expect(() => parseSiteConfig(site({ sameAs: 'https://x.com' }))).toThrow(
      'site.json "site.sameAs" must be HTTP(S) URLs',
    )
    expect(() => parseSiteConfig(site({ topics: ['design', 2] }))).toThrow(
      'site.json "topics" must be an array of strings',
    )
    expect(() =>
      parseSiteConfig(site({ product: { name: 'P', description: 'd', path: '/p/', offers: { availability: 1 } } })),
    ).toThrow('site.json "product.offers.availability" must be a string')
  })

  test('returns only declared settings', () => {
    const decoded = parseSiteConfig(
      site({
        organization: { name: 'O', address: { addressCountry: 'DK' } },
        topics: ['design'],
        robots: {},
      }),
    )
    expect(decoded).toEqual({
      name: 'Example',
      url: 'https://example.com',
      description: 'Useful site.',
      organization: { name: 'O', address: { addressCountry: 'DK' } },
      topics: ['design'],
      robots: {},
    })
  })
})
