import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'fs/promises'
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

  test('uses source file mtime as route lastModified when available', async () => {
    await withTempDir(async (rootDir) => {
      const source = join(rootDir, 'src', 'pages', 'about.html')
      await mkdir(join(source, '..'), { recursive: true })
      await writeFile(source, '<h1>About</h1>')
      const modified = new Date('2026-05-26T10:30:00.000Z')
      await utimes(source, modified, modified)

      const graph = new RouteGraph({
        composer: testComposer(),
        distDir: join(rootDir, 'dist'),
        sourceRoot: rootDir,
      })

      await graph.compose(
        { slug: 'about', kind: 'static', source: 'src/pages/about.html' },
        '<h1>About</h1>',
      )

      expect(graph.records()[0]?.lastModified).toBe(modified.toISOString())
    })
  })

  test('derives generated route lastModified from linked route records', async () => {
    await withTempDir(async (rootDir) => {
      const source = join(rootDir, 'content', 'posts', 'hello.md')
      await mkdir(join(source, '..'), { recursive: true })
      await writeFile(source, 'hello')
      const modified = new Date('2026-05-27T08:00:00.000Z')
      await utimes(source, modified, modified)

      const graph = new RouteGraph({
        composer: testComposer(),
        distDir: join(rootDir, 'dist'),
        sourceRoot: rootDir,
      })

      await graph.compose(
        { slug: 'insights/hello', kind: 'content', source: 'content/posts/hello.md' },
        '<h1>Hello</h1>',
      )
      await graph.compose(
        { slug: 'insights', kind: 'generated', source: 'generated:insights' },
        '<a href="/insights/hello/">Hello</a>',
      )

      expect(graph.records().find((record) => record.slug === 'insights')?.lastModified).toBe(modified.toISOString())
    })
  })
})
