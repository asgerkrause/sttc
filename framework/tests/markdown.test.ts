import { describe, expect, test } from 'bun:test'
import { BuildError } from '../build/errors'
import { assertSafeContentMarkdown } from '../build/content'
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

  test('rejects script and style tags in CMS markdown with source file line and hint', () => {
    const scriptSource = `---
title: Bad
---

Intro
<script>alert(1)</script>`

    try {
      assertSafeContentMarkdown(scriptSource, 'content/posts/bad.md')
      throw new Error('expected BuildError')
    } catch (err) {
      expect(err).toBeInstanceOf(BuildError)
      const build = err as BuildError
      expect(build.message).toBe('Unsafe <script> tag in CMS markdown')
      expect(build.file).toBe('content/posts/bad.md')
      expect(build.line).toBe(6)
      expect(build.hint).toContain('component <style> blocks')
    }

    expect(() => assertSafeContentMarkdown('Safe line\n<style>.x{}</style>', 'content/pages/bad.md')).toThrow(BuildError)
  })

  test('allows controlled bare HTML tags and escapes unsafe attributes', () => {
    expect(render('<br>')).toBe('<br>')
    expect(render('<hr />')).toBe('<hr />')
    expect(render('<br onclick=alert(1)>')).toBe('<p>&lt;br onclick=alert(1)&gt;</p>')
    expect(render('<hr style="color:red">')).toBe('<p>&lt;hr style=&quot;color:red&quot;&gt;</p>')
    expect(render('<span onclick="alert(1)">Bad</span>')).toBe('<p>&lt;span onclick=&quot;alert(1)&quot;&gt;Bad&lt;/span&gt;</p>')
    expect(render('<span href="javascript:alert(1)">Bad</span>')).toBe('<p>&lt;span href=&quot;javascript:alert(1)&quot;&gt;Bad&lt;/span&gt;</p>')
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

  test('rejects malformed front matter with the file and line', () => {
    expect(() => parseFrontMatter(`---
title: "Unclosed
---

Body`, 'content/posts/a.md')).toThrow('Invalid front-matter YAML')
  })
})
