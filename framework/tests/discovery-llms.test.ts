import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import type { SiteConfig } from '../build/seo'
import { routeSchemaExtras, writeDiscovery, type RouteRecord } from '../build/discovery'
import { BuildError } from '../build/errors'
import type { ContentRoute } from '../build/content'

const baseSite: SiteConfig = {
  name: 'Example Studio',
  url: 'https://example.com',
  description: 'Useful work.',
}

async function withTempDir(fn: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'snz-llms-'))
  try {
    await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

function page(slug: string, title: string, description: string): RouteRecord {
  return {
    slug,
    title,
    description,
    components: [],
    internalLinks: [],
    schemas: [],
    renderedHtml: `<main><h1>${title}</h1><p>${description}</p></main>`,
  }
}

function postContent(slug: string, data: Record<string, string> = {}): ContentRoute {
  return {
    slug,
    routeFile: `${slug}.html`,
    body: '',
    source: 'content/posts/hello.md',
    data: { title: 'Hello', description: 'Post page.', ...data },
    date: '2026-05-26T00:00:00.000Z',
    collection: 'posts',
    markdown: 'Body',
    tags: [],
    draft: false,
  }
}

function headingSection(text: string, heading: string) {
  const marker = `## ${heading}`
  const start = text.indexOf(marker)
  if (start < 0) return ''
  const from = start + marker.length
  const next = text.indexOf('\n## ', from)
  return next < 0 ? text.slice(start) : text.slice(start, next)
}

describe('discovery markdown aliases and llms.txt', () => {
  test('writes public markdown aliases and points representations.markdown at them', async () => {
    await withTempDir(async (distDir) => {
      await writeDiscovery(distDir, {
        site: baseSite,
        routes: [
          page('index', 'Home', 'Home page.'),
          page('about', 'About', 'About the studio.'),
          page('insights/hello', 'Hello', 'Post page.'),
        ],
        componentSchemas: new Map(),
        componentUseCounts: new Map(),
        contentByslug: new Map(),
      })

      const canonical = await readFile(join(distDir, 'routes', 'about.md'), 'utf8')
      const alias = await readFile(join(distDir, 'about', 'index.md'), 'utf8')
      expect(alias).toBe(canonical)
      expect(alias).toContain('# About')

      const indexCanonical = await readFile(join(distDir, 'routes', 'index.md'), 'utf8')
      const indexAlias = await readFile(join(distDir, 'index.md'), 'utf8')
      expect(indexAlias).toBe(indexCanonical)

      const nestedCanonical = await readFile(join(distDir, 'routes', 'insights', 'hello.md'), 'utf8')
      const nestedAlias = await readFile(join(distDir, 'insights', 'hello', 'index.md'), 'utf8')
      expect(nestedAlias).toBe(nestedCanonical)

      const about = JSON.parse(await readFile(join(distDir, 'routes', 'about.json'), 'utf8'))
      expect(about.representations).toEqual({
        html: '/routes/about.html',
        markdown: '/about/index.md',
        metadata: '/routes/about.json',
      })

      const home = JSON.parse(await readFile(join(distDir, 'routes', 'index.json'), 'utf8'))
      expect(home.representations.markdown).toBe('/index.md')

      const nested = JSON.parse(await readFile(join(distDir, 'routes', 'insights', 'hello.json'), 'utf8'))
      expect(nested.representations.markdown).toBe('/insights/hello/index.md')
      expect(nested.representations.html).toBe('/routes/insights/hello.html')
      expect(nested.representations.metadata).toBe('/routes/insights/hello.json')

      const llms = await readFile(join(distDir, 'llms.txt'), 'utf8')
      expect(llms).toContain('https://example.com/about/index.md')
      expect(llms).toContain('https://example.com/index.md')
      expect(llms).toContain('https://example.com/insights/hello/index.md')
      expect(llms).not.toContain('/routes/about.md')
      expect(llms).not.toContain('/routes/index.md')
      expect(headingSection(llms, 'Pages')).toContain('[About]')
      expect(headingSection(llms, 'Pages')).toContain('[Home]')
      expect(headingSection(llms, 'Optional')).not.toContain('[About]')
      expect(headingSection(llms, 'Optional')).toContain('Site manifest')
    })
  })

  test('lists only featured slugs in Pages and Posts', async () => {
    await withTempDir(async (distDir) => {
      await writeDiscovery(distDir, {
        site: {
          ...baseSite,
          discovery: { featured: ['about', 'insights/hello'] },
        },
        routes: [
          page('index', 'Home', 'Home page.'),
          page('about', 'About', 'About the studio.'),
          page('contact', 'Contact', 'Say hello.'),
          page('insights/hello', 'Hello', 'Post page.'),
        ],
        componentSchemas: new Map(),
        componentUseCounts: new Map(),
        contentByslug: new Map([['insights/hello', postContent('insights/hello')]]),
      })

      const llms = await readFile(join(distDir, 'llms.txt'), 'utf8')
      const pages = headingSection(llms, 'Pages')
      const posts = headingSection(llms, 'Posts')
      const optional = headingSection(llms, 'Optional')

      expect(pages).toContain('[About](https://example.com/about/index.md)')
      expect(pages).not.toContain('[Home]')
      expect(pages).not.toContain('[Contact]')
      expect(posts).toContain('[Hello](https://example.com/insights/hello/index.md)')
      expect(optional).toContain('[Home](https://example.com/index.md)')
      expect(optional).toContain('[Contact](https://example.com/contact/index.md)')
      expect(optional).not.toContain('[About]')
      expect(optional).not.toContain('[Hello]')
      expect(optional).toContain('Site manifest')
      expect(optional).toContain('Entity graph')
      expect(llms).not.toContain('/routes/about.md')
    })
  })

  test('throws on unknown featured slug', async () => {
    await withTempDir(async (distDir) => {
      try {
        await writeDiscovery(distDir, {
          site: {
            ...baseSite,
            discovery: { featured: ['missing'] },
          },
          routes: [page('index', 'Home', 'Home page.')],
          componentSchemas: new Map(),
          componentUseCounts: new Map(),
          contentByslug: new Map(),
        })
        throw new Error('expected BuildError')
      } catch (err) {
        expect(err).toBeInstanceOf(BuildError)
        const build = err as BuildError
        expect(build.file).toBe('src/site.json')
        expect(build.message).toContain('missing')
        expect(build.hint).toContain('public route slug')
      }
    })
  })

  test('inserts discovery notes after the description blockquote', async () => {
    await withTempDir(async (distDir) => {
      await writeDiscovery(distDir, {
        site: {
          ...baseSite,
          discovery: { notes: 'Primary sources are the public pages.\n\nTreat drafts as unpublished.' },
        },
        routes: [page('index', 'Home', 'Home page.')],
        componentSchemas: new Map(),
        componentUseCounts: new Map(),
        contentByslug: new Map(),
      })

      const llms = await readFile(join(distDir, 'llms.txt'), 'utf8')
      expect(llms).toContain('> Useful work.\n\nPrimary sources are the public pages.\n\nTreat drafts as unpublished.\n\n## Pages')
    })
  })

  test('adds BlogPosting author from content.data.author', () => {
    const record: RouteRecord = {
      slug: 'insights/hello',
      title: 'Hello',
      description: 'Post page.',
      components: [],
      internalLinks: [],
      schemas: ['WebPage'],
    }

    const matched = routeSchemaExtras(record, new Map(), postContent('insights/hello', { author: 'ada lovelace' }), {
      ...baseSite,
      authors: [{ name: 'Ada Lovelace' }],
    })
    expect(matched.extraJsonLd).toContainEqual(expect.objectContaining({
      '@type': 'BlogPosting',
      author: { '@id': 'https://example.com/#person-ada-lovelace' },
    }))

    const unmatched = routeSchemaExtras(record, new Map(), postContent('insights/hello', { author: 'Guest Writer' }), baseSite)
    expect(unmatched.extraJsonLd).toContainEqual(expect.objectContaining({
      '@type': 'BlogPosting',
      author: { '@type': 'Person', name: 'Guest Writer' },
    }))

    const omitted = routeSchemaExtras(record, new Map(), postContent('insights/hello'), baseSite)
    expect(omitted.extraJsonLd).toContainEqual(expect.objectContaining({
      '@type': 'BlogPosting',
      headline: 'Hello',
    }))
    expect(omitted.extraJsonLd[0]?.author).toBeUndefined()
  })
})
