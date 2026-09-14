import { describe, expect, test } from 'bun:test'
import { htmlToMarkdown } from '../build/markdown-output'

describe('agent-readable Markdown output', () => {
  test('preserves headings, ordered lists, fenced code, tables, and definitions', () => {
    const markdown = htmlToMarkdown(`<head><title>Hidden</title></head>
<h1>Guide</h1>
<ol><li>First</li><li>Second</li></ol>
<pre><code>const x = 1\nconsole.log(x)</code></pre>
<table><tr><th>Name</th><th>Price</th></tr><tr><td>Pro</td><td>49</td></tr></table>
<dl><dt>Static</dt><dd>No hydration.</dd></dl>`)

    expect(markdown).toContain('# Guide')
    expect(markdown).toContain('1. First\n2. Second')
    expect(markdown).toContain('```\nconst x = 1\nconsole.log(x)\n```')
    expect(markdown).toContain('| Name | Price |\n| --- | --- |\n| Pro | 49 |')
    expect(markdown).toContain('**Static**\nNo hydration.')
    expect(markdown).not.toContain('Hidden')
  })

  test('keeps links, code, images, and emphasis inside list items and table cells', () => {
    const markdown = htmlToMarkdown(`<ul><li><a href="/docs/">Docs</a> with <code>bun run build</code></li><li><strong>Bold</strong> and <em>soft</em></li></ul>
<table><tr><th>Name</th><th>Link</th></tr><tr><td><img src="/assets/images/a.webp" alt="A"></td><td><a href="https://example.com/">Site</a></td></tr></table>
<h2>Use <code>&lt;Image&gt;</code></h2>`)

    expect(markdown).toContain('- [Docs](/docs/) with `bun run build`')
    expect(markdown).toContain('- **Bold** and *soft*')
    expect(markdown).toContain('| ![A](/assets/images/a.webp) | [Site](https://example.com/) |')
    expect(markdown).toContain('## Use `<Image>`')
  })

  test('keeps a linked image alone and inside a list item', () => {
    const markdown = htmlToMarkdown(`<p><a href="/full/"><img src="/thumb.webp" alt="Preview"></a></p>
<ul><li><a href="/full/"><img src="/thumb.webp" alt="Preview"></a> caption</li></ul>`)

    expect(markdown).toContain('[![Preview](/thumb.webp)](/full/)')
    expect(markdown).toContain('- [![Preview](/thumb.webp)](/full/) caption')
  })
})
