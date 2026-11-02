import { describe, expect, test } from 'bun:test'
import { BuildError } from '../build/errors'
import { autoGenerateIndexes } from '../build/generated-routes'
import { normalizeContentTags, type ContentRoute } from '../build/content'
import { slugify } from '../build/markdown'
import type { RouteGraph } from '../build/route-graph'
import { nextComponent, parseAttrs } from '../build/tags'

describe('component tag parser', () => {
  test('parses attrs including boolean flags', () => {
    expect(parseAttrs(' title="Hello" disabled data-id="x"')).toEqual({
      title: 'Hello',
      disabled: '1',
      'data-id': 'x',
    })
  })

  test('finds self-closing component tags', () => {
    const match = nextComponent('<section><Image src="hero" /></section>')

    expect(match?.name).toBe('Image')
    expect(match?.attrs).toEqual({ src: 'hero' })
    expect(match?.selfClosing).toBe(true)
    expect(match?.children).toBe('')
  })

  test('finds paired tags with children', () => {
    const match = nextComponent('<Card title="One"><p>Body</p></Card>')

    expect(match?.name).toBe('Card')
    expect(match?.selfClosing).toBe(false)
    expect(match?.children).toBe('<p>Body</p>')
    expect(match?.full).toBe('<Card title="One"><p>Body</p></Card>')
  })

  test('handles nested same-name component pairs', () => {
    const match = nextComponent('<Card><Card>Inner</Card><p>Outer</p></Card>')

    expect(match?.children).toBe('<Card>Inner</Card><p>Outer</p>')
    expect(match?.full).toBe('<Card><Card>Inner</Card><p>Outer</p></Card>')
  })

  test('throws on missing close tag', () => {
    expect(() => nextComponent('<Card>Missing close')).toThrow(BuildError)
  })

  test('rejects single-quoted and unquoted attributes with file, line, and tag', () => {
    for (const tag of ["<Card title='x' />", '<Card title=y />', "<Card title='x'>Body</Card>"]) {
      let error: unknown
      try {
        nextComponent(`<p>Intro</p>\n${tag}`, 0, 'src/pages/page.html')
      } catch (err) {
        error = err
      }
      expect(error).toBeInstanceOf(BuildError)
      const build = error as BuildError
      expect(build.file).toBe('src/pages/page.html')
      expect(build.line).toBe(2)
      expect(build.message).toContain('<Card />')
    }
  })

  test('accepts double-quoted values, bare flags, and values containing >', () => {
    const match = nextComponent('<Card title="a > b" open data-id="x"/>')
    expect(match?.attrs).toEqual({ title: 'a > b', open: '1', 'data-id': 'x' })
    expect(match?.selfClosing).toBe(true)
    expect(nextComponent('<Card>\n<Card title="in" />\n</Card>')?.children).toBe('\n<Card title="in" />\n')
  })

  test('normalizes content tag labels separately from route slugs', () => {
    expect(slugify('R&D <SEO>')).toBe('r-d-seo')
    expect(normalizeContentTags([' Case Study ', 'case-study', 'R&D <SEO>', '!!!'])).toEqual([
      'Case Study',
      'R&D <SEO>',
    ])
  })

  test('generated tag routes use safe slugs and escaped display labels', async () => {
    const bodies = new Map<string, string>()
    const routeGraph = {
      async compose(owner: { slug: string }, body: string) {
        bodies.set(owner.slug, body)
      },
    }
    const post: ContentRoute = {
      slug: 'insights/post',
      routeFile: 'insights/post.html',
      body: '',
      source: 'content/posts/post.md',
      data: { title: 'Post', date: '2026-06-18', description: 'Desc' },
      collection: 'posts',
      markdown: '',
      tags: ['R&D <SEO>'],
      draft: false,
    }

    await autoGenerateIndexes(routeGraph as unknown as RouteGraph, [post])

    expect(bodies.has('tags/r-d-seo')).toBe(true)
    expect(bodies.get('tags/r-d-seo')).toContain('<h1>Tag: <code>R&amp;D &lt;SEO&gt;</code></h1>')
    expect(bodies.get('tags')).toContain('<a href="/tags/r-d-seo/">R&amp;D &lt;SEO&gt;</a>')
  })
})
