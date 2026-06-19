import { describe, expect, test } from 'bun:test'
import { createComposer, type ComponentSchema } from '../build/compose'
import { BuildError } from '../build/errors'
import { extractRouteTopScripts } from '../build/extract-js'
import { rejectStyleInRoute } from '../build/extract-css'
import { nextComponent } from '../build/tags'

const seo = '<title>{{title}}</title>'

function expectBuildError(err: unknown, line: number, file: string) {
  expect(err).toBeInstanceOf(BuildError)
  const build = err as BuildError
  expect(build.file).toBe(file)
  expect(build.line).toBe(line)
}

function composer(schemas = new Map<string, ComponentSchema>()) {
  return createComposer(
    new Map([
      ['SEO', seo],
      ['Card', '<article>{{title}}</article>'],
      ['Image', '<figure>{{imgMain}}</figure>'],
    ]),
    schemas,
    () => ({ hero: { width: 100, height: 50, placeholder: 'data:image/png;base64,x' } }),
  )
}

describe('build error source spans', () => {
  test('reports route style line', () => {
    try {
      rejectStyleInRoute('<h1>Page</h1>\n<style>.x{}</style>', 'src/pages/page.html')
      throw new Error('expected BuildError')
    } catch (err) {
      expectBuildError(err, 2, 'src/pages/page.html')
    }
  })

  test('reports route body script line', () => {
    try {
      extractRouteTopScripts('<h1>Page</h1>\n<script>bad()</script>', 'src/pages/page.html')
      throw new Error('expected BuildError')
    } catch (err) {
      expectBuildError(err, 2, 'src/pages/page.html')
    }
  })

  test('reports unknown component line', async () => {
    try {
      await composer().prepareRouteSource('<p>Intro</p>\n<Missing />', { slug: 'page', fileHint: 'src/pages/page.html' })
      throw new Error('expected BuildError')
    } catch (err) {
      expectBuildError(err, 2, 'src/pages/page.html')
    }
  })

  test('reports missing required attr line', async () => {
    const schemas = new Map<string, ComponentSchema>([
      ['Card', { attrs: { title: { required: true, description: 'Card title.' } } }],
    ])

    try {
      await composer(schemas).prepareRouteSource('<p>Intro</p>\n<Card />', { slug: 'page', fileHint: 'src/pages/page.html' })
      throw new Error('expected BuildError')
    } catch (err) {
      expectBuildError(err, 2, 'src/pages/page.html')
    }
  })

  test('reports image attr line', async () => {
    try {
      await composer().prepareRouteSource('<p>Intro</p>\n<Image src="hero" />', { slug: 'page', fileHint: 'src/pages/page.html' })
      throw new Error('expected BuildError')
    } catch (err) {
      expectBuildError(err, 2, 'src/pages/page.html')
    }
  })

  test('reports unclosed component line', () => {
    try {
      nextComponent('<p>Intro</p>\n<Card>', 0, 'src/pages/page.html')
      throw new Error('expected BuildError')
    } catch (err) {
      expectBuildError(err, 2, 'src/pages/page.html')
    }
  })

  test('allows global track attr and emits data-snz-track', async () => {
    const schemas = new Map<string, ComponentSchema>([
      ['Card', { attrs: { title: { required: true } } }],
    ])
    const html = await composer(schemas).prepareRouteSource(
      '<Card title="Contact" track="Contact CTA" />',
      { slug: 'page', fileHint: 'src/pages/page.html' },
    )
    expect(html).toContain('<article data-snz-track="Contact CTA">Contact</article>')
  })
})
