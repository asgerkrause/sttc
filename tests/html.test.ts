import { describe, expect, test } from 'bun:test'
import { extractHtmlDescription, extractHtmlTitle, scanHtmlInternalLinks } from '../build/html'

describe('HTML discovery helpers', () => {
  test('extracts title text', () => {
    expect(extractHtmlTitle('<html><head><title> Hello world </title></head></html>')).toBe('Hello world')
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

  test('dedupes internal links', () => {
    const html = '<a href="/about/">One</a><a href="/about/">Two</a><a href="/work/">Work</a>'

    expect(scanHtmlInternalLinks(html)).toEqual(['/about/', '/work/'])
  })

  test('drops hash and query from internal links', () => {
    const html = '<a href="/about/?ref=nav">Query</a><a href="/work/#case">Hash</a>'

    expect(scanHtmlInternalLinks(html)).toEqual(['/about/', '/work/'])
  })
})
