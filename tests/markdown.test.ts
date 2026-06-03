import { describe, expect, test } from 'bun:test'
import { BuildError } from '../build/errors'
import { fmString, fmStringArray, parseFrontMatter, render } from '../build/markdown'

describe('markdown renderer', () => {
  test('renders headings, tables, and fenced code contracts', () => {
    const html = render(`# Hello, World!

| Feature | Status |
| --- | --- |
| Tables | Yes |

\`\`\`ts
const ok = true
\`\`\`
`)

    expect(html).toContain('<h1 id="hello-world">Hello, World!</h1>')
    expect(html).toContain('<table><thead><tr><th>Feature</th><th>Status</th></tr></thead>')
    expect(html).toContain('<td>Tables</td><td>Yes</td>')
    expect(html).toContain('<pre><code class="lang-ts">const ok = true</code></pre>')
  })

  test('rejects unsafe URLs and unsafe HTML', () => {
    expect(() => render('[Bad](javascript:alert(1))', { file: 'post.md' })).toThrow(BuildError)
    expect(() => render('<script>alert(1)</script>', { file: 'post.md' })).toThrow(BuildError)
  })

  test('preserves PascalCase component passthrough', () => {
    expect(render('<Button label="Contact" href="/contact/" />')).toBe('<Button label="Contact" href="/contact/" />')
    expect(render('<Card title="A">Body</Card>')).toBe('<Card title="A">Body</Card>')
  })

  test('parses front matter strings and arrays', () => {
    const { data, body } = parseFrontMatter(`---
title: Hello
tags: [one, two]
draft: false
---

Body`)

    expect(fmString(data, 'title')).toBe('Hello')
    expect(fmStringArray(data, 'tags')).toEqual(['one', 'two'])
    expect(fmString(data, 'draft')).toBe('false')
    expect(body.trim()).toBe('Body')
  })
})
