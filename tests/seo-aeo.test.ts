import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { buildSchemaGraph, type SiteConfig } from '../build/seo'
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

  test('computes canonical FAQ and component schema extras without mutating route record', () => {
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
    expect(extras.schemas).toEqual(['WebPage', 'Service', 'FAQPage'])
    expect(extras.extraJsonLd.map((node) => node['@type'])).toEqual(['Service', 'FAQPage'])
    expect(extras.extraJsonLd[1]).toMatchObject({
      '@type': 'FAQPage',
      mainEntity: [{ '@type': 'Question', name: 'Question?', acceptedAnswer: { '@type': 'Answer', text: 'Answer.' } }],
    })
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
        }],
        componentSchemas: new Map(),
        componentUseCounts: new Map(),
        contentByslug: new Map(),
      })

      const llms = await readFile(join(distDir, 'llms.txt'), 'utf8')
      const manifest = JSON.parse(await readFile(join(distDir, 'site.manifest.json'), 'utf8'))
      const route = JSON.parse(await readFile(join(distDir, 'routes', 'index.json'), 'utf8'))

      expect(llms).not.toContain('## Site facts')
      expect(manifest.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION)
      expect(manifest.generator).toEqual({ name: GENERATOR_NAME, version: GENERATOR_VERSION })
      expect(route.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION)
      expect(route.generator).toEqual({ name: GENERATOR_NAME, version: GENERATOR_VERSION })
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
        }],
        componentSchemas: new Map(),
        componentUseCounts: new Map(),
        contentByslug: new Map([['insights/hello', {
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
        }]]),
      })

      const route = JSON.parse(await readFile(join(distDir, 'routes', 'insights', 'hello.json'), 'utf8'))
      expect(route.schemas).toEqual(['WebPage', 'BlogPosting'])
      expect(route.extraJsonLd).toContainEqual(expect.objectContaining({
        '@type': 'BlogPosting',
        headline: 'Hello',
        datePublished: '2026-05-26T00:00:00.000Z',
      }))
    })
  })

  test('writes rich site facts to llms and ai-plugin metadata', async () => {
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
      const plugin = JSON.parse(await readFile(join(distDir, '.well-known', 'ai-plugin.json'), 'utf8'))

      expect(llms).toContain('## Site facts')
      expect(llms).toContain('- Topics: AEO, SEO')
      expect(llms).toContain('- Same-as: https://github.com/example')
      expect(llms).toContain('- Contact: hello@example.com')
      expect(plugin.contact_email).toBe('hello@example.com')
    })
  })
})
