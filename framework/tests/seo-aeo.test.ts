import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, stat } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { buildSchemaGraph, writeRobots, writeSitemap, type SiteConfig } from '../build/seo'
import { MANIFEST_SCHEMA_VERSION, routeSchemaExtras, writeDiscovery } from '../build/discovery'
import { GENERATOR_NAME, GENERATOR_VERSION } from '../build/version'

const baseSite: SiteConfig = {
  name: 'Example Studio',
  url: 'https://example.com',
  description: 'Useful work.',
}

async function withTempDir(fn: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'snz-aeo-'))
  try {
    await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

describe('AEO/GEO site facts', () => {
  test('omits rich organization fields when site config stays minimal', () => {
    const graph = buildSchemaGraph(baseSite, {
      title: 'Home',
      description: 'Home page.',
      canonical: 'https://example.com/',
    })
    const organization = graph['@graph'][0] as Record<string, unknown>
    const website = graph['@graph'][1] as Record<string, unknown>

    expect(organization['@id']).toBe('https://example.com/#organization')
    expect(website['@id']).toBe('https://example.com/#website')
    expect(website.publisher).toEqual({ '@id': 'https://example.com/#organization' })
    expect(organization.sameAs).toBeUndefined()
    expect(organization.contactPoint).toBeUndefined()
    expect(organization.address).toBeUndefined()
    expect(website.knowsAbout).toBeUndefined()
  })

  test('merges route schema extras into baseline graph', () => {
    const graph = buildSchemaGraph(baseSite, {
      title: 'Post',
      description: 'Post page.',
      canonical: 'https://example.com/insights/post/',
    }, [{ '@type': 'BlogPosting', headline: 'Post' }])

    expect(graph['@graph'].map((node) => node['@type'])).toEqual(['Organization', 'WebSite', 'WebPage', 'BlogPosting'])
  })

  test('emits rich organization and topic facts when configured', () => {
    const graph = buildSchemaGraph({
      ...baseSite,
      organization: {
        legalName: 'Example Studio LLC',
        sameAs: ['https://www.linkedin.com/company/example'],
        contact: { email: 'hello@example.com', url: '/contact/' },
        address: { addressLocality: 'Copenhagen', addressCountry: 'DK' },
      },
      topics: ['Bun', 'Static sites'],
    }, {
      title: 'Home',
      description: 'Home page.',
      canonical: 'https://example.com/',
    })

    const organization = graph['@graph'][0] as Record<string, unknown>
    const website = graph['@graph'][1] as Record<string, unknown>

    expect(organization).toMatchObject({
      legalName: 'Example Studio LLC',
      sameAs: ['https://www.linkedin.com/company/example'],
      contactPoint: { '@type': 'ContactPoint', email: 'hello@example.com', url: 'https://example.com/contact/' },
      address: { '@type': 'PostalAddress', addressLocality: 'Copenhagen', addressCountry: 'DK' },
    })
    expect(website.knowsAbout).toEqual(['Bun', 'Static sites'])
  })

  test('emits brand and product only on the configured product route', () => {
    const site: SiteConfig = {
      ...baseSite,
      brand: { slogan: 'Ship with confidence' },
      product: {
        name: 'Example Platform',
        description: 'A release platform.',
        path: '/platform/',
        offers: { price: '49.00', priceCurrency: 'USD', availability: 'InStock' },
      },
    }
    const productGraph = buildSchemaGraph(site, {
      title: 'Platform',
      description: 'A release platform.',
      canonical: 'https://example.com/platform/',
    })
    const aboutGraph = buildSchemaGraph(site, {
      title: 'About',
      description: 'About Example Studio.',
      canonical: 'https://example.com/about/',
    })

    expect(productGraph['@graph'].map((node) => node['@type'])).toEqual(['Organization', 'Brand', 'WebSite', 'WebPage', 'Product'])
    expect(productGraph['@graph'].at(-1)).toMatchObject({
      '@id': 'https://example.com/platform/#product',
      brand: { '@id': 'https://example.com/#brand' },
      offers: { price: '49.00', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
    })
    expect(aboutGraph['@graph'].some((node) => node['@type'] === 'Product')).toBe(false)
  })

  test('uses explicit component schema without name-based semantics or record mutation', () => {
    const record = {
      slug: 'faq',
      title: 'FAQ',
      description: 'Questions.',
      components: [
        { name: 'Accordion', attrs: { summary: 'Question?', body: '<p>Answer.</p>' } as Record<string, string> },
        { name: 'ServiceCard', attrs: { title: 'Design', href: '/design/' } as Record<string, string> },
      ],
      internalLinks: [],
      schemas: ['WebPage'],
    }
    const extras = routeSchemaExtras(record, new Map([['ServiceCard', {
      schema: { type: 'Service', map: { name: 'title', url: 'href' } },
    }]]), undefined, baseSite)

    expect(record.schemas).toEqual(['WebPage'])
    expect(extras.schemas).toEqual(['WebPage', 'Service'])
    expect(extras.extraJsonLd).toEqual([{ '@type': 'Service', name: 'Design', url: '/design/' }])
  })

  test('does not publish filesystem route mtime as an editorial BlogPosting date', () => {
    const extras = routeSchemaExtras({
      slug: 'insights/hello',
      title: 'Hello',
      description: 'Post page.',
      components: [],
      internalLinks: [],
      schemas: ['WebPage'],
      lastModified: '2026-05-27T08:00:00.000Z',
    }, new Map(), {
      slug: 'insights/hello',
      routeFile: 'insights/hello.html',
      body: '',
      source: 'content/posts/hello.md',
      data: { title: 'Hello', date: '2026-05-26', description: 'Post page.' },
      date: '2026-05-26T00:00:00.000Z',
      collection: 'posts',
      markdown: 'Body',
      tags: [],
      draft: false,
    }, baseSite)

    expect(extras.extraJsonLd).toContainEqual(expect.objectContaining({
      '@type': 'BlogPosting',
      dateModified: undefined,
    }))
  })

  test('writes discovery version metadata without requiring rich site config', async () => {
    await withTempDir(async (distDir) => {
      await writeDiscovery(distDir, {
        site: baseSite,
        routes: [{
          slug: 'index',
          title: 'Home',
          description: 'Home page.',
          components: [],
          internalLinks: [],
          schemas: [],
          renderedHtml: '<head><title>Home</title></head><main><h1>Home</h1><p>Useful page.</p></main>',
        }],
        componentSchemas: new Map(),
        componentUseCounts: new Map(),
        contentByslug: new Map(),
      })

      const llms = await readFile(join(distDir, 'llms.txt'), 'utf8')
      const manifest = JSON.parse(await readFile(join(distDir, 'site.manifest.json'), 'utf8'))
      const route = JSON.parse(await readFile(join(distDir, 'routes', 'index.json'), 'utf8'))
      const markdown = await readFile(join(distDir, 'routes', 'index.md'), 'utf8')

      expect(llms).not.toContain('## Site facts')
      expect(llms).toContain('https://example.com/index.md')
      expect(llms).not.toContain('https://example.com/routes/index.md')
      expect(markdown).toContain('# Home')
      expect(manifest.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION)
      expect(manifest.generator).toEqual({ name: GENERATOR_NAME, version: GENERATOR_VERSION })
      expect(route.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION)
      expect(route.generator).toEqual({ name: GENERATOR_NAME, version: GENERATOR_VERSION })
    })
  })

  test('keeps unlisted route metadata direct but omits it from public discovery', async () => {
    await withTempDir(async (distDir) => {
      await writeDiscovery(distDir, {
        site: baseSite,
        routes: [
          { slug: 'index', title: 'Home', description: 'Home page.', components: [], internalLinks: ['/preview/'], schemas: [], unlisted: false },
          { slug: 'preview', title: 'Preview', description: 'Direct preview.', components: [], internalLinks: [], schemas: ['WebPage'], unlisted: true },
        ],
        componentSchemas: new Map(),
        componentUseCounts: new Map(),
        contentByslug: new Map(),
      })

      const llms = await readFile(join(distDir, 'llms.txt'), 'utf8')
      const manifest = JSON.parse(await readFile(join(distDir, 'site.manifest.json'), 'utf8'))
      expect(llms).not.toContain('Direct preview.')
      expect(manifest.routes.map((item: { slug: string }) => item.slug)).toEqual(['index'])
      await expect(stat(join(distDir, 'routes', 'preview.json'))).rejects.toThrow()
      await expect(stat(join(distDir, 'routes', 'preview.md'))).rejects.toThrow()
    })
  })

  test('writes BlogPosting extras and schemas for post content', async () => {
    await withTempDir(async (distDir) => {
      await writeDiscovery(distDir, {
        site: baseSite,
        routes: [{
          slug: 'insights/hello',
          title: 'Hello',
          description: 'Post page.',
          components: [],
          internalLinks: [],
          schemas: ['WebPage'],
          lastModified: '2026-05-27T08:00:00.000Z',
        }],
        componentSchemas: new Map(),
        componentUseCounts: new Map(),
        contentByslug: new Map([['insights/hello', {
          slug: 'insights/hello',
          routeFile: 'insights/hello.html',
          body: '',
          source: 'content/posts/hello.md',
          data: { title: 'Hello', date: '2026-05-26', dateModified: '2026-05-28', description: 'Post page.' },
          date: '2026-05-26T00:00:00.000Z',
          collection: 'posts',
          markdown: 'Body',
          tags: [],
          draft: false,
        }]]),
      })

      const route = JSON.parse(await readFile(join(distDir, 'routes', 'insights', 'hello.json'), 'utf8'))
      expect(route.schemas).toEqual(['WebPage', 'BlogPosting'])
      expect(route.extraJsonLd).toContainEqual(expect.objectContaining({
        '@type': 'BlogPosting',
        headline: 'Hello',
        datePublished: '2026-05-26T00:00:00.000Z',
        dateModified: '2026-05-28T00:00:00.000Z',
      }))
    })
  })

  test('writes explicit standard robots groups', async () => {
    await withTempDir(async (distDir) => {
      await writeRobots(distDir, baseSite.url, [
        { userAgents: ['OAI-SearchBot', 'ChatGPT-User'], allow: ['/'] },
        { userAgents: ['GPTBot'], disallow: ['/'] },
      ])
      const robots = await readFile(join(distDir, 'robots.txt'), 'utf8')
      expect(robots).toContain('User-agent: OAI-SearchBot\nUser-agent: ChatGPT-User\nAllow: /')
      expect(robots).toContain('User-agent: GPTBot\nDisallow: /')
      expect(robots).toContain('Sitemap: https://example.com/sitemap.xml')
    })
  })

  test('writes sitemap lastmod when route records provide it', async () => {
    await withTempDir(async (distDir) => {
      await writeSitemap(distDir, baseSite.url, [
        { slug: 'index', lastModified: '2026-05-26T10:30:00.000Z' },
        { slug: '404', lastModified: '2026-05-26T10:30:00.000Z' },
        { slug: 'preview', unlisted: true },
        'about',
      ])

      const sitemap = await readFile(join(distDir, 'sitemap.xml'), 'utf8')

      expect(sitemap).toContain('<loc>https://example.com/</loc><lastmod>2026-05-26T10:30:00.000Z</lastmod>')
      expect(sitemap).toContain('<loc>https://example.com/about/</loc></url>')
      expect(sitemap).not.toContain('/404/')
      expect(sitemap).not.toContain('/preview/')
    })
  })

  test('writes rich public site facts without legacy plugin metadata', async () => {
    await withTempDir(async (distDir) => {
      await writeDiscovery(distDir, {
        site: {
          ...baseSite,
          sameAs: ['https://github.com/example'],
          contact: { email: 'hello@example.com', url: '/contact/' },
          topics: ['AEO', 'SEO'],
        },
        routes: [],
        componentSchemas: new Map(),
        componentUseCounts: new Map(),
        contentByslug: new Map(),
      })

      const llms = await readFile(join(distDir, 'llms.txt'), 'utf8')
      const manifest = JSON.parse(await readFile(join(distDir, 'site.manifest.json'), 'utf8'))

      expect(llms).toContain('## Site facts')
      expect(llms).toContain('- Topics: AEO, SEO')
      expect(llms).toContain('- Same-as: https://github.com/example')
      expect(llms).toContain('- Contact: hello@example.com')
      expect(manifest.site.contact.email).toBe('hello@example.com')
      await expect(stat(join(distDir, '.well-known', 'ai-plugin.json'))).rejects.toThrow()
    })
  })
})
