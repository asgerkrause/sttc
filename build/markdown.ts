// Tiny markdown subset: headings, paragraphs, lists, links, images, code, emphasis, blockquotes, hr.
// Hand-rolled to avoid a node_modules dependency. ~150 lines. Not CommonMark-strict — covers the 95% case.

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
function esc(s: string) { return s.replace(/[&<>"]/g, (c) => ESC[c]) }

function inline(src: string): string {
  // Order matters: code spans first (they swallow other syntax).
  let s = src
  // Inline code
  s = s.replace(/`([^`\n]+)`/g, (_, code) => `<code>${esc(code)}</code>`)
  // Images: ![alt](url "title")
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, alt, url, title) => {
    const t = title ? ` title="${esc(title)}"` : ''
    return `<img src="${esc(url)}" alt="${esc(alt)}"${t} loading="lazy">`
  })
  // Links: [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, url) => `<a href="${esc(url)}">${esc(text)}</a>`)
  // Bold + italic
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  s = s.replace(/_([^_\n]+)_/g, '<em>$1</em>')
  return s
}

type Block = { kind: 'heading' | 'p' | 'ul' | 'ol' | 'pre' | 'quote' | 'hr' | 'html'; depth?: number; content: string }

function tokenize(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') { i++; continue }

    // Fenced code
    const fence = line.match(/^```(\w*)\s*$/)
    if (fence) {
      const lang = fence[1]
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].match(/^```\s*$/)) { buf.push(lines[i]); i++ }
      if (i < lines.length) i++ // consume closing fence
      const code = esc(buf.join('\n'))
      const langClass = lang ? ` class="lang-${esc(lang)}"` : ''
      blocks.push({ kind: 'pre', content: `<pre><code${langClass}>${code}</code></pre>` })
      continue
    }

    // Heading
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      const depth = heading[1].length
      blocks.push({ kind: 'heading', depth, content: inline(heading[2].trim()) })
      i++; continue
    }

    // HR
    if (/^[-*_]{3,}\s*$/.test(line)) {
      blocks.push({ kind: 'hr', content: '<hr>' })
      i++; continue
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++ }
      const inner = render(buf.join('\n'))
      blocks.push({ kind: 'quote', content: `<blockquote>${inner}</blockquote>` })
      continue
    }

    // Lists
    const ulMatch = line.match(/^[-*+]\s+(.*)$/)
    const olMatch = line.match(/^(\d+)\.\s+(.*)$/)
    if (ulMatch || olMatch) {
      const isOl = !!olMatch
      const buf: string[] = []
      while (i < lines.length) {
        const m = isOl ? lines[i].match(/^(\d+)\.\s+(.*)$/) : lines[i].match(/^[-*+]\s+(.*)$/)
        if (!m) break
        buf.push(`<li>${inline((isOl ? m[2] : m[1]).trim())}</li>`)
        i++
      }
      const tag = isOl ? 'ol' : 'ul'
      blocks.push({ kind: isOl ? 'ol' : 'ul', content: `<${tag}>${buf.join('')}</${tag}>` })
      continue
    }

    // HTML block (starts with `<`)
    if (/^</.test(line)) {
      const buf: string[] = [line]
      i++
      while (i < lines.length && lines[i].trim() !== '') { buf.push(lines[i]); i++ }
      blocks.push({ kind: 'html', content: buf.join('\n') })
      continue
    }

    // Paragraph
    const buf: string[] = [line]
    i++
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,6}\s|>|[-*+]\s|\d+\.\s|```)/.test(lines[i])) {
      buf.push(lines[i]); i++
    }
    blocks.push({ kind: 'p', content: `<p>${inline(buf.join(' ').trim())}</p>` })
  }
  return blocks
}

export function render(src: string): string {
  return tokenize(src).map((b) => {
    if (b.kind === 'heading') return `<h${b.depth}>${b.content}</h${b.depth}>`
    return b.content
  }).join('\n')
}

const FRONT_MATTER_RE = /^---\n([\s\S]*?)\n---\n?/

export function parseFrontMatter(src: string): { data: Record<string, string>; body: string } {
  const m = src.match(FRONT_MATTER_RE)
  if (!m) return { data: {}, body: src }
  const data: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/)
    if (!kv) continue
    let value = kv[2].trim()
    if (/^["'].*["']$/.test(value)) value = value.slice(1, -1)
    data[kv[1]] = value
  }
  return { data, body: src.slice(m[0].length) }
}
