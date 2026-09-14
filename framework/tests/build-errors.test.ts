import { describe, expect, test } from 'bun:test'
import { createComposer, type ComponentSchema } from '../build/compose'
import type { TemplateContext } from '../build/template-directives'
import { BuildError } from '../build/errors'
import { extractRouteTopScripts } from '../build/extract-js'
import { extractRouteStyleBlocks } from '../build/extract-css'
import { nextComponent } from '../build/tags'
import { parseInlineSchema } from '../build/component-meta'

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
      ['Grid', '{#if cols}<div g="{{cols}}" x="{{x}}">{{slot}}</div>{:else}<div g x="{{x}}">{{slot}}</div>{/if}'],
      ['MaybeSlot', '<div>{#if slot:vis}<span>{{slot:vis}}</span>{/if}<b>{{label}}</b></div>'],
      ['MaybeAttr', '<div>{#if eyebrow}<p>{{eyebrow}}</p>{/if}<b>{{title}}</b></div>'],
      ['BadIf', '<div>{#if slot:vis}<span>{{slot:vis}}</span></div>'],
      ['BadElse', '<div>{#if title}<b>{{title}}</b>{:else}<i>Missing</i>{/if}</div>'],
      ['ElseIf', '<div>{#if title}<b>{{title}}</b>{:else if eyebrow}<i>{{eyebrow}}</i>{:else}<em>None</em>{/if}</div>'],
      ['Hero', '<p>{{title}}</p><aside>{{slot:aside}}</aside>'],
      ['Titled', '<div title="{{title}}">{{slot}}</div>'],
      ['Gallery', '<ul>{#each items as item}<li>{#if item.image}<img src="{{item.image}}">{:else}<span>{{item.name}}</span>{/if}</li>{/each}</ul>'],
      ['BadDoubleElse', '<div>{#if title}<b>{{title}}</b>{:else}<i>Missing</i>{:else}<em>Bad</em>{/if}</div>'],
      ['BadEach', '<div>{#each items as item}<b>{{item}}</b>{/each}</div>'],
      ['Logo', '<a class="logo">{#if slot}<span aria-hidden="true">{{slot}}</span>{/if}<span>{{siteName}}</span></a>'],
      ['Code', '<figure class="code">{#if lang}<figcaption>{{lang}}</figcaption>{/if}<pre><code data-language="{{lang}}">{{slot}}</code></pre></figure>'],
      ['Counter', '<span class="count" data-value="{{value}}" data-duration="{{duration}}"><span>{#if prefix}{{prefix}}{/if}<data value="{{value}}">{{value}}</data>{#if suffix}{{suffix}}{/if}</span>{#if label}<small>{{label}}</small>{/if}</span>'],
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
      ['Button', { attrs: { label: {}, href: {}, variant: { enum: ['accent tone'], asClass: true } } }],
    ])
    const html = await composer(schemas).prepareRouteSource(
      '<Button label="Go" variant="accent tone" />',
      { slug: 'page', fileHint: 'src/pages/page.html' },
    )
    expect(html).toContain('<a class="btn accent tone">Go</a>')
  })

  test('allows empty optional enum attrs', async () => {
    const schemas = new Map<string, ComponentSchema>([
      ['Card', { attrs: { title: {}, variant: { enum: ['outlined', 'ghost', 'accent'], asClass: true } } }],
    ])
    const html = await composer(schemas).prepareRouteSource(
      '<Card title="Plain" variant="" />',
      { slug: 'page', fileHint: 'src/pages/page.html' },
    )
    expect(html).toContain('<article>Plain</article>')
  })

  test('rejects unsafe class-backed attr tokens', async () => {
    const schemas = new Map<string, ComponentSchema>([
      ['Button', { attrs: { label: {}, href: {}, variant: { asClass: true } } }],
    ])
    try {
      await composer(schemas).prepareRouteSource('<Button variant="accent/evil" />', { slug: 'page', fileHint: 'src/pages/page.html' })
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

  test('keeps Grid active when cols is omitted', async () => {
    const html = await composer().prepareRouteSource(
      '<Grid>Default</Grid>\n<Grid cols="12-6" x="5-3">Responsive</Grid>',
      { slug: 'page', fileHint: 'src/pages/page.html' },
    )
    expect(html).toContain('<div g>Default</div>')
    expect(html).toContain('<div g="12-6" x="5-3">Responsive</div>')
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

  test('renders else-if chains and binds else to the innermost block', async () => {
    const html = await composer().prepareRouteSource(
      '<ElseIf title="Card" eyebrow="New" />\n<ElseIf eyebrow="New" />\n<ElseIf />',
      { slug: 'page', fileHint: 'src/pages/page.html' },
    )
    expect(html).toContain('<div><b>Card</b></div>')
    expect(html).toContain('<div><i>New</i></div>')
    expect(html).toContain('<div><em>None</em></div>')
  })

  test('renders nested each and if blocks per item', async () => {
    const html = await composer(new Map(), new Map([['Gallery', {
      items: [{ name: 'One', image: '/one.webp' }, { name: 'Two' }],
    }]])).prepareRouteSource('<Gallery />', { slug: 'page', fileHint: 'src/pages/page.html' })
    expect(html).toContain('<ul><li><img src="/one.webp"></li><li><span>Two</span></li></ul>')
  })

  test('escapes attribute text once with and without component data', async () => {
    const withData = new Map<string, TemplateContext>([['Hero', { extra: 'x' }]])
    for (const data of [new Map<string, TemplateContext>(), withData]) {
      const html = await composer(new Map(), data).prepareRouteSource(
        '<Hero title="Tom & Jerry"><slot name="aside">Raw <b>html</b></slot></Hero>\n<Hero title="Tom &amp; Jerry" />',
        { slug: 'page', fileHint: 'src/pages/page.html' },
      )
      expect(html).toContain('<p>Tom &amp; Jerry</p><aside>Raw <b>html</b></aside>')
      expect(html).toContain('<p>Tom &amp; Jerry</p><aside></aside>')
      expect(html).not.toContain('&amp;amp;')
    }
  })

  test('never rescans interpolated attribute text as a slot', async () => {
    const html = await composer().prepareRouteSource(
      '<Titled title="{{slot}}">say "hello"</Titled>\n<Titled title="Caf&eacute;"><b>x</b></Titled>',
      { slug: 'page', fileHint: 'src/pages/page.html' },
    )
    // The literal attribute value is text, not a slot; the prune then drops it as an unresolved placeholder.
    expect(html).toContain('<div>say "hello"</div>')
    expect(html).toContain('<div title="Café"><b>x</b></div>')
  })

  test('renders SEO titles once from escaped attribute text', async () => {
    const html = await composer().prepareRouteSource(
      '<head><SEO title="Hello &amp; welcome" /></head><h1>Hi</h1>',
      { slug: 'page', fileHint: 'src/pages/page.html' },
    )
    expect(html).toContain('<title>Hello &amp; welcome</title>')
    expect(html).not.toContain('&amp;amp;')
  })

  test('rejects SEO outside the route head with its line', async () => {
    try {
      await composer().prepareRouteSource('<head><SEO title="Head" /></head>\n<h1>Page</h1>\n<SEO title="Body" />', {
        slug: 'page',
        fileHint: 'src/pages/page.html',
      })
      throw new Error('expected BuildError')
    } catch (err) {
      expectBuildError(err, 3, 'src/pages/page.html')
      expect((err as BuildError).hint).toBe('Keep exactly one self-closing <SEO ... /> inside the route <head>.')
    }
  })

  test('names the component file and the page line for a malformed template', async () => {
    try {
      await composer().prepareRouteSource('<p>Intro</p>\n<BadIf />', { slug: 'page', fileHint: 'src/pages/page.html' })
      throw new Error('expected BuildError')
    } catch (err) {
      expect(err).toBeInstanceOf(BuildError)
      const build = err as BuildError
      expect(build.file).toBe('src/components/BadIf.html')
      expect(build.frames).toEqual([{ file: 'src/pages/page.html', line: 2, label: '<BadIf />' }])
    }
  })

  test('rejects unknown contract tags and malformed attr lines with file and line', () => {
    const file = 'src/components/Hero.html'
    for (const [comment, message] of [
      ['<!--\n  @desc Hero.\n  @atr title!\n-->', 'Unknown contract tag "@atr"'],
      ['<!--\n  @desc Hero.\n  @attr size ! big\n-->', 'Malformed @attr "size ! big"'],
    ]) {
      try {
        parseInlineSchema(`${comment}<section></section>`, file)
        throw new Error('expected BuildError')
      } catch (err) {
        expectBuildError(err, 3, file)
        expect((err as BuildError).message).toBe(message)
      }
    }
    try {
      parseInlineSchema('<!--\n  @atr title!\n-->', file)
      throw new Error('expected BuildError')
    } catch (err) {
      expect((err as BuildError).hint).toBe('Supported: @desc, @attr, @schema')
    }
    const { schema } = parseInlineSchema('<!--\n  @attr variant=[a|b] :class Visual style.\n  @attr tone =[c|d] Spaced enum.\n  @attr title! Heading.\n-->', file)
    expect(schema.attrs).toEqual({
      variant: { enum: ['a', 'b'], asClass: true, description: 'Visual style.' },
      tone: { enum: ['c', 'd'], description: 'Spaced enum.' },
      title: { required: true, description: 'Heading.' },
    })
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
    const siteName = (await Bun.file('src/site.json').json() as { name: string }).name
    const html = await composer().prepareRouteSource(
      '<Logo />\n<Logo><svg></svg></Logo>\n<Code>plain</Code>\n<Counter value="10" />\n<Counter value="10" prefix="$" suffix="k" label="Revenue" />',
      { slug: 'page', fileHint: 'src/pages/page.html' },
    )
    expect(html).toContain(`<a class="logo"><span>${siteName}</span></a>`)
    expect(html).toContain(`<a class="logo"><span aria-hidden="true"><svg></svg></span><span>${siteName}</span></a>`)
    expect(html).toContain('<figure class="code"><pre><code>plain</code></pre></figure>')
    expect(html).toContain('<span class="count" data-value="10"><span><data value="10">10</data></span></span>')
    expect(html).toContain('<span class="count" data-value="10"><span>$<data value="10">10</data>k</span><small>Revenue</small></span>')
    expect(html).not.toContain('{{prefix}}')
    expect(html).not.toContain('{{suffix}}')
  })
})
