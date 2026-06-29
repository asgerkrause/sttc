import { describe, expect, test } from 'bun:test'
import { createComposer, type ComponentSchema } from '../build/compose'
import type { TemplateContext } from '../build/template-directives'
import { BuildError } from '../build/errors'
import { extractRouteTopScripts } from '../build/extract-js'
import { extractRouteStyleBlocks } from '../build/extract-css'
import { nextComponent } from '../build/tags'

const seo = '<title>{{title}}</title>'

function expectBuildError(err: unknown, line: number, file: string) {
  expect(err).toBeInstanceOf(BuildError)
  const build = err as BuildError
  expect(build.file).toBe(file)
  expect(build.line).toBe(line)
}

function composer(schemas = new Map<string, ComponentSchema>(), data = new Map<string, TemplateContext>()) {
  return createComposer(
    new Map([
      ['SEO', seo],
      ['Card', '<article>{{title}}</article>'],
      ['Button', '<a class="btn">{{label}}</a>'],
      ['Image', '<figure>{{imgMain}}</figure>'],
      ['Wrapper', '<section>\n<Image src="missing" alt="Missing" />\n</section>'],
      ['Section', '<section>{{slot}}</section>'],
      ['MaybeSlot', '<div>{#if slot:vis}<span>{{slot:vis}}</span>{/if}<b>{{label}}</b></div>'],
      ['MaybeAttr', '<div>{#if eyebrow}<p>{{eyebrow}}</p>{/if}<b>{{title}}</b></div>'],
      ['BadIf', '<div>{#if slot:vis}<span>{{slot:vis}}</span></div>'],
      ['BadElse', '<div>{#if title}<b>{{title}}</b>{:else}<i>Missing</i>{/if}</div>'],
      ['BadElseIf', '<div>{#if title}<b>{{title}}</b>{:else if eyebrow}<i>{{eyebrow}}</i>{/if}</div>'],
      ['BadDoubleElse', '<div>{#if title}<b>{{title}}</b>{:else}<i>Missing</i>{:else}<em>Bad</em>{/if}</div>'],
      ['BadEach', '<div>{#each items as item}<b>{{item}}</b>{/each}</div>'],
      ['Logo', '<a class="logo">{#if slot}<span class="logo-mark">{{slot}}</span>{/if}<span class="logo-type">{{siteName}}</span></a>'],
      ['Code', '<figure>{#if lang}<figcaption>{{lang}}</figcaption>{/if}<pre>{{slot}}</pre></figure>'],
      ['Counter', '<span>{#if prefix}<b>{{prefix}}</b>{/if}<i>0</i>{#if suffix}<b>{{suffix}}</b>{/if}{#if label}<em>{{label}}</em>{/if}</span>'],
      ['Icon', '{#if label}<span class="icon" role="img" aria-label="{{label}}">{{slot}}</span>{:else}<span class="icon" aria-hidden="true">{{slot}}</span>{/if}'],
      ['Split', '{#if label}<span class="split" data-split aria-label="{{label}}">{{slot}}</span>{:else}<span class="split" data-split>{{slot}}</span>{/if}'],
      ['FAQ', '<div class="faq">{#each items as item}<Accordion group="faq" summary="{{item.summary}}" body="{{item.body}}" />{/each}</div>'],
      ['Accordion', '<details><summary>{{summary}}</summary><div>{{body}}</div></details>'],
    ]),
    schemas,
    () => ({ hero: { width: 100, height: 50, placeholder: 'data:image/png;base64,x' } }),
    undefined,
    undefined,
    data,
  )
}

describe('build error source spans', () => {
  test('extracts route style blocks instead of leaving inline CSS in routes', () => {
    const result = extractRouteStyleBlocks('<h1>Page</h1>\n<style>.x{}</style>')
    expect(result.html).toBe('<h1>Page</h1>')
    expect(result.css).toEqual(['.x{}'])
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

  test('pretty prints source stack frames', () => {
    const err = new BuildError('Nested failure', {
      file: 'src/components/Card.html',
      line: 2,
      hint: 'Fix nested component.',
      frames: [{ file: 'src/pages/page.html', line: 5, label: '<Card />' }],
    })

    expect(err.toPretty()).toContain('BuildError: Nested failure (src/components/Card.html:2)')
    expect(err.toPretty()).toContain('source stack:')
    expect(err.toPretty()).toContain('<Card /> src/pages/page.html:5')
    expect(err.toJSON()).toMatchObject({
      frames: [{ file: 'src/pages/page.html', line: 5, label: '<Card />' }],
    })
  })

  test('adds route source frame for nested component errors', async () => {
    try {
      await composer().prepareRouteSource('<p>Intro</p>\n<Wrapper />', { slug: 'page', fileHint: 'src/pages/page.html' })
      throw new Error('expected BuildError')
    } catch (err) {
      expectBuildError(err, 2, 'src/components/Wrapper.html')
      const build = err as BuildError
      expect(build.frames).toEqual([{ file: 'src/pages/page.html', line: 2, label: '<Wrapper />' }])
      expect(build.toPretty()).toContain('source stack:')
      expect(build.toPretty()).toContain('<Wrapper /> src/pages/page.html:2')
    }
  })

  test('splits class-backed attr values into safe class tokens', async () => {
    const schemas = new Map<string, ComponentSchema>([
      ['Button', { attrs: { label: {}, href: {}, color: { enum: ['accent tone'], asClass: true } } }],
    ])
    const html = await composer(schemas).prepareRouteSource(
      '<Button label="Go" color="accent tone" />',
      { slug: 'page', fileHint: 'src/pages/page.html' },
    )
    expect(html).toContain('<a class="btn accent tone">Go</a>')
  })

  test('allows empty optional enum attrs', async () => {
    const schemas = new Map<string, ComponentSchema>([
      ['Card', { attrs: { title: {}, variant: { enum: ['outlined', 'ghost'], asClass: true }, theme: { enum: ['accent'] } } }],
    ])
    const html = await composer(schemas).prepareRouteSource(
      '<Card title="Plain" variant="" theme="" />',
      { slug: 'page', fileHint: 'src/pages/page.html' },
    )
    expect(html).toContain('<article>Plain</article>')
  })

  test('rejects unsafe class-backed attr tokens', async () => {
    const schemas = new Map<string, ComponentSchema>([
      ['Button', { attrs: { label: {}, href: {}, color: { asClass: true } } }],
    ])
    try {
      await composer(schemas).prepareRouteSource('<Button color="accent/evil" />', { slug: 'page', fileHint: 'src/pages/page.html' })
      throw new Error('expected BuildError')
    } catch (err) {
      expect(err).toBeInstanceOf(BuildError)
      expect((err as BuildError).message).toContain('Invalid class token')
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

  test('renders component conditional blocks from named slots', async () => {
    const html = await composer().prepareRouteSource(
      '<MaybeSlot label="Go"><slot name="vis">→</slot></MaybeSlot>\n<MaybeSlot label="No" />',
      { slug: 'page', fileHint: 'src/pages/page.html' },
    )
    expect(html).toContain('<div><span>→</span><b>Go</b></div>')
    expect(html).toContain('<div><b>No</b></div>')
  })

  test('preserves nested named slots for child components', async () => {
    const html = await composer().prepareRouteSource(
      '<Section><MaybeSlot label="Go"><slot name="vis">→</slot></MaybeSlot></Section>',
      { slug: 'page', fileHint: 'src/pages/page.html' },
    )
    expect(html).toContain('<section><div><span>→</span><b>Go</b></div></section>')
  })

  test('renders component conditional blocks from attrs', async () => {
    const html = await composer().prepareRouteSource(
      '<MaybeAttr title="Card" eyebrow="New" />\n<MaybeAttr title="Plain" />',
      { slug: 'page', fileHint: 'src/pages/page.html' },
    )
    expect(html).toContain('<div><p>New</p><b>Card</b></div>')
    expect(html).toContain('<div><b>Plain</b></div>')
  })

  test('reports malformed component conditional blocks', async () => {
    try {
      await composer().prepareRouteSource('<BadIf />', { slug: 'page', fileHint: 'src/pages/page.html' })
      throw new Error('expected BuildError')
    } catch (err) {
      expect(err).toBeInstanceOf(BuildError)
      expect((err as BuildError).message).toContain('Unclosed component conditional')
    }
  })

  test('renders component conditional else branches', async () => {
    const html = await composer().prepareRouteSource(
      '<BadElse title="Card" />\n<BadElse />',
      { slug: 'page', fileHint: 'src/pages/page.html' },
    )
    expect(html).toContain('<div><b>Card</b></div>')
    expect(html).toContain('<div><i>Missing</i></div>')
  })

  test('uses if-else for accessible icon and split markup', async () => {
    const html = await composer().prepareRouteSource(
      '<Icon label="Status">!</Icon>\n<Icon />\n<Split label="Intro text">Intro text</Split>\n<Split>Plain text</Split>',
      { slug: 'page', fileHint: 'src/pages/page.html' },
    )
    expect(html).toContain('<span class="icon" role="img" aria-label="Status">!</span>')
    expect(html).toContain('<span class="icon" aria-hidden="true"></span>')
    expect(html).toContain('<span class="split" data-split aria-label="Intro text">Intro text</span>')
    expect(html).toContain('<span class="split" data-split>Plain text</span>')
  })

  test('renders FAQ from component JSON data with each', async () => {
    const html = await composer(new Map(), new Map([['FAQ', {
      items: [
        { summary: 'One', body: 'First' },
        { summary: 'Two', body: 'Second' },
      ],
    }]])).prepareRouteSource('<FAQ />', { slug: 'page', fileHint: 'src/pages/page.html' })
    expect(html).toContain('<summary>One</summary><div>First</div>')
    expect(html).toContain('<summary>Two</summary><div>Second</div>')
  })

  test('rejects unsupported component conditional branches', async () => {
    try {
      await composer().prepareRouteSource('<BadElseIf title="Card" eyebrow="New" />', { slug: 'page', fileHint: 'src/pages/page.html' })
      throw new Error('expected BuildError')
    } catch (err) {
      expect(err).toBeInstanceOf(BuildError)
      expect((err as BuildError).message).toContain('Unsupported component conditional branch')
    }
  })

  test('rejects duplicate component else branches', async () => {
    try {
      await composer().prepareRouteSource('<BadDoubleElse />', { slug: 'page', fileHint: 'src/pages/page.html' })
      throw new Error('expected BuildError')
    } catch (err) {
      expect(err).toBeInstanceOf(BuildError)
      expect((err as BuildError).message).toContain('Duplicate component conditional else')
    }
  })

  test('rejects each blocks in components without JSON data', async () => {
    try {
      await composer().prepareRouteSource('<BadEach />', { slug: 'page', fileHint: 'src/pages/page.html' })
      throw new Error('expected BuildError')
    } catch (err) {
      expect(err).toBeInstanceOf(BuildError)
      expect((err as BuildError).message).toContain('Unsupported component each block')
    }
  })

  test('omits optional built-in component fragments with conditionals', async () => {
    const html = await composer().prepareRouteSource(
      '<Logo />\n<Logo><svg></svg></Logo>\n<Code>plain</Code>\n<Counter value="10" />\n<Counter value="10" prefix="$" suffix="k" label="Revenue" />',
      { slug: 'page', fileHint: 'src/pages/page.html' },
    )
    expect(html).toContain('<a class="logo"><span class="logo-type">SNZ</span></a>')
    expect(html).toContain('<a class="logo"><span class="logo-mark"><svg></svg></span><span class="logo-type">SNZ</span></a>')
    expect(html).toContain('<figure><pre>plain</pre></figure>')
    expect(html).toContain('<span><i>0</i></span>')
    expect(html).toContain('<span><b>$</b><i>0</i><b>k</b><em>Revenue</em></span>')
  })
})
