import { describe, expect, test } from 'bun:test'
import { decodeEntities, extractHtmlDescription, extractHtmlMetadata, extractHtmlTitle, scanHtmlInternalLinks } from '../build/html'

describe('HTML discovery helpers', () => {
  test('extracts route metadata in one parser pass', () => {
    expect(extractHtmlMetadata('<title>Page</title><meta name="description" content="Summary"><a href="/about/">About</a>')).toEqual({
      title: 'Page',
      description: 'Summary',
      internalLinks: ['/about/'],
      schemas: [],
    })
  })

  test('extracts title text', () => {
    expect(extractHtmlTitle('<html><head><title> Hello world </title></head></html>')).toBe('Hello world')
  })

  test('decodes entities in title and description', () => {
    const html = '<title>Terms &amp; Conditions</title><meta name="description" content="Fish &amp; chips &lt;3">'

    expect(extractHtmlMetadata(html)).toMatchObject({ title: 'Terms & Conditions', description: 'Fish & chips <3' })
  })

  test('decodes named and numeric character references in one pass', () => {
    expect(decodeEntities('Caf&eacute; &copy; a &ndash; b&hellip;')).toBe('Café © a – b…')
    expect(decodeEntities('&#38;amp; &#x26; &amp;lt;')).toBe('&amp; & &lt;')
    expect(decodeEntities('&bogus; &copy=1 x &amp y')).toBe('&bogus; &copy=1 x & y')
    expect(decodeEntities('Price &#128;10 &#x9F; Caf&#233 Caf&#xE9 x')).toBe('Price €10 Ÿ Café Café x')
    expect(decodeEntities('&constructor; &toString; &valueOf; &__proto__;')).toBe('&constructor; &toString; &valueOf; &__proto__;')
  })

  test('extracts meta description content', () => {
    const html = '<meta name="description" content=" Useful summary. ">'

    expect(extractHtmlDescription(html)).toBe('Useful summary.')
  })

  test('scans only internal links', () => {
    const html = `
      <a href="/about/">About</a>
      <a href="https://example.com/offsite">External</a>
      <a href="//example.com/protocol-relative">Protocol relative</a>
      <a href="mailto:hello@example.com">Email</a>
    `

    expect(scanHtmlInternalLinks(html)).toEqual(['/about/'])
  })

  test('detects visible Schema.org microdata types', () => {
    const html = '<section itemscope itemtype="https://schema.org/FAQPage"><details itemscope itemtype="https://schema.org/Question"></details></section>'

    expect(extractHtmlMetadata(html).schemas).toEqual(['FAQPage', 'Question'])
  })

  test('dedupes internal links', () => {
    const html = '<a href="/about/">One</a><a href="/about/">Two</a><a href="/work/">Work</a>'

    expect(scanHtmlInternalLinks(html)).toEqual(['/about/', '/work/'])
  })

  test('drops hash and query from internal links', () => {
    const html = '<a href="/about/?ref=nav">Query</a><a href="/work/#case">Hash</a>'

    expect(scanHtmlInternalLinks(html)).toEqual(['/about/', '/work/'])
  })
})
