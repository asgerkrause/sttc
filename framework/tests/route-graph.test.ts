import { describe, expect, test } from 'bun:test'
import type { Composer, ComposeInstance, RouteComposeInput } from '../build/compose'
import { RouteGraph } from '../build/route-graph'

function testComposer(): Composer {
  return {
    resetSiteConfig() {},
    prepareShellSource: async (raw: string) => raw,
    prepareRoute: async (raw: string, route: RouteComposeInput) => ({ html: `<head>
<title>${route.slug}</title>
<meta name="description" content="${route.fileHint}">
</head>
${raw}`, unlisted: false }),
    prepareRouteSource: async (raw: string, route: RouteComposeInput) => `<head>
<title>${route.slug}</title>
<meta name="description" content="${route.fileHint}">
</head>
${raw}`,
  }
}

describe('route graph', () => {
  test('composes and records route metadata with the rendered HTML in one record', async () => {
    const instances: ComposeInstance[] = [{ name: 'Section', attrs: {}, route: 'insights' }]
    const graph = new RouteGraph({
      composer: testComposer(),
      instancesFor: (slug) => slug === 'insights' ? instances : [],
    })

    const { html } = await graph.compose(
      { slug: 'insights', kind: 'generated', source: 'generated:insights' },
      '<Section><a href="/insights/one/">One</a></Section>',
      { schemas: ['CollectionPage'] },
    )

    expect(html).toContain('<Section>')
    expect(graph.slugs()).toEqual(['insights'])
    expect(graph.records()).toMatchObject([{
      slug: 'insights',
      title: 'insights',
      description: 'generated:insights',
      components: instances,
      internalLinks: ['/insights/one/'],
      schemas: ['CollectionPage'],
      renderedHtml: html,
    }])
  })

  test('records visible Schema.org microdata types', async () => {
    const graph = new RouteGraph({ composer: testComposer() })
    await graph.compose(
      { slug: 'faq', kind: 'static', source: 'src/pages/faq.html' },
      '<section itemscope itemtype="https://schema.org/FAQPage"></section>',
    )

    expect(graph.records()[0]?.schemas).toEqual(['WebPage', 'FAQPage'])
  })

  test('keeps lastModified only when the caller supplies one', async () => {
    const graph = new RouteGraph({ composer: testComposer() })
    await graph.compose({ slug: 'about', kind: 'static', source: 'src/pages/about.html' }, '<h1>About</h1>')
    await graph.compose(
      { slug: 'insights/hello', kind: 'content', source: 'content/posts/hello.md' },
      '<h1>Hello</h1>',
      { lastModified: '2026-05-27T08:00:00.000Z' },
    )
    await graph.compose({ slug: 'insights', kind: 'generated', source: 'generated:insights' }, '<a href="/insights/hello/">Hello</a>')

    const bySlug = new Map(graph.records().map((record) => [record.slug, record.lastModified]))
    expect(bySlug.get('about')).toBeUndefined()
    expect(bySlug.get('insights/hello')).toBe('2026-05-27T08:00:00.000Z')
    expect(bySlug.get('insights')).toBeUndefined()
  })

  test('keeps records in caller index order', async () => {
    const graph = new RouteGraph({ composer: testComposer() })
    await graph.compose({ slug: 'b', kind: 'static', source: 'src/pages/b.html' }, '<h1>B</h1>', { index: 1 })
    await graph.compose({ slug: 'a', kind: 'static', source: 'src/pages/a.html' }, '<h1>A</h1>', { index: 0 })
    await graph.compose({ slug: 'tags', kind: 'generated', source: 'generated:tags' }, '<h1>Tags</h1>')

    expect(graph.records().map((record) => record.slug)).toEqual(['a', 'b', 'tags'])
  })
})
