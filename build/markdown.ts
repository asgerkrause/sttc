// Markdown renderer v2: small, safe, dependency-free.
// Covers CMS/site authoring needs: headings with ids, paragraphs, lists, tables,
// links/images, code fences, blockquotes, hr, emphasis, and controlled inline HTML.

import { BuildError, lineOf } from './errors'

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const FRONT_MATTER_RE = /^---\n([\s\S]*?)\n---\n?/
const SAFE_COMPONENT_RE = /^(?:<\/?[A-Z][A-Za-z0-9]*(?:\s[^>]*)?>|<[A-Z][A-Za-z0-9]*(?:\s[^>]*)?>[\s\S]*<\/[A-Z][A-Za-z0-9]*>)\s*$/
const SAFE_HTML_RE = /^<\/?(?:br|hr|sup|sub|small|mark|kbd|abbr|cite|span)(?:\s[^>]*)?>\s*$/i

export type MarkdownOptions = {
  file?: string
  headingIds?: boolean
}

function esc(s: string) { return s.replace(/[&<>\"]/g, (c) => ESC[c]) }

function slugify(s: string) {
  return stripTags(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function stripTags(s: string) {
  return s.replace(/<[^>]+>/g, '').replace(/&[a-z0-9#]+;/gi, '').trim()
}

function isSafeUrl(raw: string) {
  const url = raw.trim()
  if (!url) return false
  if (/^(#|\/|\.\/|\.\.\/)/.test(url)) return true
  if (/^(https?:|mailto:|tel:)/i.test(url)) return true
  return false
}

function assertSafeUrl(raw: string, file: string | undefined, source: string, offset: number) {
  if (isSafeUrl(raw)) return
  throw new BuildError(`Unsafe markdown URL "${raw}"`, {
    file,
    line: file ? lineOf(source, offset) : undefined,
    hint: 'Use http(s), mailto, tel, #anchors, or site-relative paths. javascript: and unsafe data: URLs are blocked.',
  })
}

function assertNoUnsafeHtml(src: string, opts: MarkdownOptions) {
  const unsafeNames = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select'])
  for (const match of src.matchAll(/<\s*\/?\s*([A-Za-z][A-Za-z0-9]*)\b/g)) {
    const tag = match[1]
    const lower = tag.toLowerCase()
    if (!unsafeNames.has(lower)) continue
    const looksLikeComponent = /^[A-Z][A-Za-z0-9]*$/.test(tag) && tag !== tag.toUpperCase()
    if (looksLikeComponent) continue
    throw new BuildError(`Unsafe <${lower}> tag in markdown`, {
      file: opts.file,
      line: opts.file && match.index != null ? lineOf(src, match.index) : undefined,
      hint: `Remove <${tag}> from markdown. Use PascalCase components for interactive or styled behavior.`,
    })
  }
}

function inline(src: string, opts: MarkdownOptions, fullSource: string): string {
  let s = esc(src)

  s = s.replace(/`([^`\n]+)`/g, (_, code) => `<code>${esc(code)}</code>`)

  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (match, alt, url, title, offset) => {
    assertSafeUrl(url, opts.file, fullSource, offset)
    const t = title ? ` title="${esc(title)}"` : ''
    return `<img src="${esc(url)}" alt="${esc(alt)}"${t} loading="lazy">`
  })

  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (match, text, url, title, offset) => {
    assertSafeUrl(url, opts.file, fullSource, offset)
    const t = title ? ` title="${esc(title)}"` : ''
    return `<a href="${esc(url)}"${t}>${inline(text, opts, fullSource)}</a>`
  })

  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  s = s.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>')
  return s
}

type Block = { kind: 'heading' | 'p' | 'ul' | 'ol' | 'pre' | 'quote' | 'hr' | 'html' | 'table'; depth?: number; content: string }

function isTableStart(lines: string[], i: number) {
  return !!lines[i]?.includes('|') && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i + 1] ?? '')
}

function splitTableRow(line: string) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim())
}

function renderTable(lines: string[], opts: MarkdownOptions, fullSource: string) {
  const headers = splitTableRow(lines[0])
  const rows = lines.slice(2).map(splitTableRow)
  const head = `<thead><tr>${headers.map((h) => `<th>${inline(h, opts, fullSource)}</th>`).join('')}</tr></thead>`
  const body = rows.length
    ? `<tbody>${rows.map((row) => `<tr>${headers.map((_, i) => `<td>${inline(row[i] ?? '', opts, fullSource)}</td>`).join('')}</tr>`).join('')}</tbody>`
    : ''
  return `<table>${head}${body}</table>`
}

function tokenize(src: string, opts: MarkdownOptions): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') { i++; continue }

    const fence = line.match(/^```([\w-]*)\s*$/)
    if (fence) {
      const lang = fence[1]
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].match(/^```\s*$/)) { buf.push(lines[i]); i++ }
      if (i < lines.length) i++
      const langClass = lang ? ` class="lang-${esc(lang)}"` : ''
      blocks.push({ kind: 'pre', content: `<pre><code${langClass}>${esc(buf.join('\n'))}</code></pre>` })
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      const depth = heading[1].length
      const content = inline(heading[2].trim(), opts, src)
      const id = opts.headingIds === false ? '' : ` id="${slugify(content)}"`
      blocks.push({ kind: 'heading', depth, content: `<h${depth}${id}>${content}</h${depth}>` })
      i++; continue
    }

    if (/^[-*_]{3,}\s*$/.test(line)) {
      blocks.push({ kind: 'hr', content: '<hr>' })
      i++; continue
    }

    if (/^>\s?/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++ }
      blocks.push({ kind: 'quote', content: `<blockquote>${render(buf.join('\n'), opts)}</blockquote>` })
      continue
    }

    if (isTableStart(lines, i)) {
      const buf = [lines[i], lines[i + 1]]
      i += 2
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') { buf.push(lines[i]); i++ }
      blocks.push({ kind: 'table', content: renderTable(buf, opts, src) })
      continue
    }

    const ulMatch = line.match(/^[-*+]\s+(.*)$/)
    const olMatch = line.match(/^(\d+)\.\s+(.*)$/)
    if (ulMatch || olMatch) {
      const isOl = !!olMatch
      const buf: string[] = []
      while (i < lines.length) {
        const m = isOl ? lines[i].match(/^(\d+)\.\s+(.*)$/) : lines[i].match(/^[-*+]\s+(.*)$/)
        if (!m) break
        buf.push(`<li>${inline((isOl ? m[2] : m[1]).trim(), opts, src)}</li>`)
        i++
      }
      const tag = isOl ? 'ol' : 'ul'
      blocks.push({ kind: isOl ? 'ol' : 'ul', content: `<${tag}>${buf.join('')}</${tag}>` })
      continue
    }

    if (/^</.test(line)) {
      const buf: string[] = [line]
      i++
      while (i < lines.length && lines[i].trim() !== '') { buf.push(lines[i]); i++ }
      const html = buf.join('\n')
      if (!SAFE_COMPONENT_RE.test(html.trim()) && !SAFE_HTML_RE.test(html.trim())) {
        blocks.push({ kind: 'p', content: `<p>${inline(html, opts, src)}</p>` })
      } else {
        blocks.push({ kind: 'html', content: html })
      }
      continue
    }

    const buf: string[] = [line]
    i++
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,6}\s|>|[-*+]\s|\d+\.\s|```)/.test(lines[i]) &&
      !isTableStart(lines, i)
    ) {
      buf.push(lines[i]); i++
    }
    blocks.push({ kind: 'p', content: `<p>${inline(buf.join(' ').trim(), opts, src)}</p>` })
  }
  return blocks
}

export function render(src: string, opts: MarkdownOptions = {}): string {
  assertNoUnsafeHtml(src, opts)
  return tokenize(src, opts).map((b) => {
    if (b.kind === 'heading') return b.content
    return b.content
  }).join('\n')
}

function parseFrontMatterLines(block: string): Record<string, string> {
  const data: Record<string, string> = {}
  for (const line of block.split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/)
    if (!kv) continue
    let value = kv[2].trim()
    if (/^["'].*["']$/.test(value)) value = value.slice(1, -1)
    data[kv[1]] = value
  }
  return data
}

/** YAML front-matter when possible; line fallback for minimal posts. */
export function parseFrontMatter(src: string): { data: Record<string, unknown>; body: string } {
  const m = src.match(FRONT_MATTER_RE)
  if (!m) return { data: {}, body: src }
  try {
    const parsed = Bun.YAML.parse(m[1])
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { data: parsed as Record<string, unknown>, body: src.slice(m[0].length) }
    }
  } catch { /* fall through */ }
  return { data: parseFrontMatterLines(m[1]), body: src.slice(m[0].length) }
}

export function fmString(data: Record<string, unknown>, key: string): string {
  const v = data[key]
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return ''
}

export function fmStringArray(data: Record<string, unknown>, key: string): string[] {
  const v = data[key]
  if (!v) return []
  if (Array.isArray(v)) return v.map((x) => String(x))
  if (typeof v === 'string') {
    const inner = v.replace(/^\[|\]$/g, '')
    return inner.split(',').map((t) => t.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
  }
  return []
}
