import { describe, expect, test } from 'bun:test'
import {
  authorsFor,
  breadcrumbList,
  buildSchemaGraph,
  isHomeCanonical,
  matchAuthor,
  personId,
  type SiteConfig,
} from '../build/seo'

const baseSite: SiteConfig = {
  name: 'Example Studio',
  url: 'https://example.com',
  description: 'Useful work.',
}

function typesOf(graph: ReturnType<typeof buildSchemaGraph>) {
  return graph['@graph'].map((node) => node['@type'])
}

function nodeOf(graph: ReturnType<typeof buildSchemaGraph>, type: string) {
  return graph['@graph'].find((node) => node['@type'] === type) as Record<string, unknown> | undefined
}

describe('schema identity and breadcrumbs', () => {
  test('emits Person nodes when author is configured', () => {
    const site: SiteConfig = {
      ...baseSite,
      brand: { slogan: 'Ship with confidence' },
      author: {
        name: 'Ada Lovelace',
        url: '/about/',
        jobTitle: 'Writer',
        sameAs: ['https://en.wikipedia.org/wiki/Ada_Lovelace'],
      },
    }
    const graph = buildSchemaGraph(site, {
      title: 'Home',
      description: 'Home page.',
      canonical: 'https://example.com/',
    })

    expect(typesOf(graph)).toEqual(['Organization', 'Brand', 'Person', 'WebSite', 'WebPage'])
    expect(nodeOf(graph, 'Person')).toEqual({
      '@type': 'Person',
      '@id': 'https://example.com/#person-ada-lovelace',
      name: 'Ada Lovelace',
      url: 'https://example.com/about/',
      jobTitle: 'Writer',
      sameAs: ['https://en.wikipedia.org/wiki/Ada_Lovelace'],
    })
    expect(personId(site, site.author!)).toBe('https://example.com/#person-ada-lovelace')
    expect(nodeOf(graph, 'Organization')?.founder).toBeUndefined()
    expect(nodeOf(graph, 'WebSite')?.author).toBeUndefined()
  })

  test('authors wins over author', () => {
    const site: SiteConfig = {
      ...baseSite,
      author: { name: 'Ada Lovelace' },
      authors: [{ name: 'Grace Hopper' }, { name: 'Alan Turing' }],
    }
    const graph = buildSchemaGraph(site, {
      title: 'Home',
      description: 'Home page.',
      canonical: 'https://example.com/',
    })
    const people = graph['@graph'].filter((node) => node['@type'] === 'Person')

    expect(authorsFor(site).map((person) => person.name)).toEqual(['Grace Hopper', 'Alan Turing'])
    expect(people.map((node) => node['@id'])).toEqual([
      'https://example.com/#person-grace-hopper',
      'https://example.com/#person-alan-turing',
    ])
    expect(matchAuthor(site, 'grace hopper')?.name).toBe('Grace Hopper')
    expect(matchAuthor(site, 'alan-turing')?.name).toBe('Alan Turing')
    expect(matchAuthor(site, 'Ada Lovelace')).toBeUndefined()
  })

  test('emits BreadcrumbList for nested routes', () => {
    const graph = buildSchemaGraph(baseSite, {
      title: 'Hello',
      description: 'Post page.',
      canonical: 'https://example.com/insights/hello/',
      slug: 'insights/hello',
    })

    expect(typesOf(graph)).toEqual(['Organization', 'WebSite', 'WebPage', 'BreadcrumbList'])
    expect(nodeOf(graph, 'BreadcrumbList')).toEqual({
      '@type': 'BreadcrumbList',
      '@id': 'https://example.com/insights/hello/#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Example Studio', item: 'https://example.com' },
        { '@type': 'ListItem', position: 2, name: 'Insights', item: 'https://example.com/insights/' },
        { '@type': 'ListItem', position: 3, name: 'Hello', item: 'https://example.com/insights/hello/' },
      ],
    })
  })

  test('uses provided route titles for intermediate breadcrumbs', () => {
    const crumbs = breadcrumbList(baseSite, {
      title: 'Hello',
      canonical: 'https://example.com/insights/hello/',
      slug: 'insights/hello',
      titlesBySlug: { insights: 'Writing' },
    })

    expect(crumbs?.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Example Studio', item: 'https://example.com' },
      { '@type': 'ListItem', position: 2, name: 'Writing', item: 'https://example.com/insights/' },
      { '@type': 'ListItem', position: 3, name: 'Hello', item: 'https://example.com/insights/hello/' },
    ])
  })

  test('omits BreadcrumbList on the homepage', () => {
    const graph = buildSchemaGraph(baseSite, {
      title: 'Home',
      description: 'Home page.',
      canonical: 'https://example.com/',
      slug: 'index',
    })

    expect(typesOf(graph)).toEqual(['Organization', 'WebSite', 'WebPage'])
    expect(breadcrumbList(baseSite, {
      title: 'Home',
      canonical: 'https://example.com',
      slug: 'about',
    })).toBeUndefined()
    expect(isHomeCanonical('https://example.com', 'https://example.com/')).toBe(true)
    expect(isHomeCanonical('https://example.com/', '/')).toBe(true)
    expect(isHomeCanonical('https://example.com', 'https://example.com/insights/hello/')).toBe(false)
  })

  test('sets dateModified on WebPage only when passed', () => {
    const dated = buildSchemaGraph(baseSite, {
      title: 'Hello',
      description: 'Post page.',
      canonical: 'https://example.com/insights/hello/',
      slug: 'insights/hello',
      dateModified: '2026-05-28T00:00:00.000Z',
    })
    const undated = buildSchemaGraph(baseSite, {
      title: 'Hello',
      description: 'Post page.',
      canonical: 'https://example.com/insights/hello/',
      slug: 'insights/hello',
    })

    expect(nodeOf(dated, 'WebPage')?.dateModified).toBe('2026-05-28T00:00:00.000Z')
    expect(nodeOf(undated, 'WebPage')?.dateModified).toBeUndefined()
  })

  test('keeps Organization first and WebSite present without identity fields', () => {
    const graph = buildSchemaGraph(baseSite, {
      title: 'Home',
      description: 'Home page.',
      canonical: 'https://example.com/',
    })

    expect(graph['@graph'][0]?.['@type']).toBe('Organization')
    expect(typesOf(graph)).toContain('WebSite')
    expect(typesOf(graph)).toEqual(['Organization', 'WebSite', 'WebPage'])
  })
})
