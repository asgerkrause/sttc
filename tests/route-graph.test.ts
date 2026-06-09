import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import type { Composer, ComposeInstance, RouteComposeInput } from '../build/compose'
import { RouteGraph } from '../build/route-graph'

function testComposer(): Composer {
  return {
    resetSiteConfig() {},
    prepareShellSource: async (raw: string) => raw,
    prepareRouteSource: async (raw: string, route: RouteComposeInput) => `<head>
<title>${route.slug}</title>
<meta name="description" content="${route.fileHint}">
</head>
${raw}`,
  }
}

async function withTempDir(fn: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'snz-route-graph-'))
  try {
    await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

describe('route graph', () => {
  test('composes, writes, and records route metadata in one operation', async () => {
    await withTempDir(async (distDir) => {
      const instances: ComposeInstance[] = [{ name: 'Section', attrs: {}, route: 'insights' }]
      const graph = new RouteGraph({
        composer: testComposer(),
        instancesFor: (slug) => slug === 'insights' ? instances : [],
        distDir,
      })

      await graph.compose(
        { slug: 'insights', kind: 'generated', source: 'generated:insights' },
        '<Section><a href="/insights/one/">One</a></Section>',
        { schemas: ['CollectionPage'] },
      )

      expect(await readFile(join(distDir, 'routes', 'insights.html'), 'utf8')).toContain('<Section>')
      expect(graph.slugs()).toEqual(['insights'])
      expect(graph.records()).toMatchObject([{
        slug: 'insights',
        title: 'insights',
        description: 'generated:insights',
        components: instances,
        internalLinks: ['/insights/one/'],
        schemas: ['CollectionPage'],
      }])
    })
  })
})
