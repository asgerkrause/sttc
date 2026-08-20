import { describe, expect, test } from 'bun:test'
import { BuildError } from '../build/errors'
import { ensureHeadingIds } from '../build/heading-ids'

describe('ensureHeadingIds', () => {
  test('adds ids to bare h1/h2', () => {
    expect(ensureHeadingIds('<h1>Hello</h1><h2>World</h2>', 'src/pages/index.html'))
      .toBe('<h1 id="hello">Hello</h1><h2 id="world">World</h2>')
  })

  test('keeps existing ids', () => {
    const html = '<h1 id="top">Hello</h1><h2 class="x" id="section-two">World</h2>'
    expect(ensureHeadingIds(html, 'src/pages/index.html')).toBe(html)
  })

  test('slugifies inner tags', () => {
    expect(ensureHeadingIds('<h2>Hello <code>API</code></h2>', 'src/pages/index.html'))
      .toBe('<h2 id="hello-api">Hello <code>API</code></h2>')
  })

  test('throws BuildError on collision', () => {
    try {
      ensureHeadingIds('<h2>Hello</h2><h2>Hello</h2>', 'src/pages/about.html')
      throw new Error('expected BuildError')
    } catch (err) {
      expect(err).toBeInstanceOf(BuildError)
      const build = err as BuildError
      expect(build.message).toBe('Duplicate heading id "hello"')
      expect(build.file).toBe('src/pages/about.html')
      expect(build.hint).toBe('Set an explicit unique id on one of the colliding headings.')
    }

    expect(() => ensureHeadingIds('<h2 id="hello">Intro</h2><h2>Hello</h2>', 'src/pages/about.html')).toThrow(BuildError)
  })

  test('leaves empty/unslugable headings unchanged', () => {
    const html = '<h2></h2><h3>!!!</h3><h4>&amp;</h4>'
    expect(ensureHeadingIds(html, 'src/pages/index.html')).toBe(html)
  })

  test('does not rewrite headings inside svg/script', () => {
    const html = '<svg><h2>Chart</h2></svg><script>const html = "<h2>Nope</h2>"</script><h2>Visible</h2>'
    expect(ensureHeadingIds(html, 'src/pages/index.html'))
      .toBe('<svg><h2>Chart</h2></svg><script>const html = "<h2>Nope</h2>"</script><h2 id="visible">Visible</h2>')
  })
})
