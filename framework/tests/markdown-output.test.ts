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
})
