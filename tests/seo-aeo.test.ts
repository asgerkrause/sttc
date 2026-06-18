import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { buildSchemaGraph, type SiteConfig } from '../build/seo'
import { writeDiscovery } from '../build/discovery'

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
