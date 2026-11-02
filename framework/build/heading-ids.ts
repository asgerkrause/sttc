// Assign stable heading ids on composed route HTML.

import { BuildError } from './errors'
import { slugify, stripTags } from './markdown'

const SKIP_OPEN_RE = /<(script|style|svg)\b/gi
const HEADING_OPEN_RE = /<h([1-6])(\s[^>]*)?>/gi
const ID_ATTR_RE = /(?:^|\s)id\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i

export function ensureHeadingIds(html: string, fileHint: string): string {
  const used = new Set<string>()
  const skipped = skippedRanges(html)

  return html.replace(HEADING_OPEN_RE, (open, level: string, attrs: string | undefined, offset: number) => {
    if (insideRange(offset, skipped)) return open

    const existing = readId(attrs ?? '')
    if (existing != null) {
      claimId(existing, used, fileHint)
      return open
    }

    const after = html.slice(offset + open.length)
    const close = after.match(new RegExp(`</h${level}>`, 'i'))
    const inner = close?.index != null ? after.slice(0, close.index) : ''
    const id = slugify(stripTags(inner))
    if (!id) return open

    claimId(id, used, fileHint)
    return `${open.slice(0, -1)} id="${id}">`
  })
}

function claimId(id: string, used: Set<string>, fileHint: string) {
  if (used.has(id)) {
    throw new BuildError(`Duplicate heading id "${id}"`, {
      file: fileHint,
      hint: 'Set an explicit unique id on one of the colliding headings.',
    })
  }
  used.add(id)
}

function readId(attrs: string) {
  const match = attrs.match(ID_ATTR_RE)
  if (!match) return undefined
  return match[1] ?? match[2] ?? match[3]
}

function skippedRanges(html: string) {
  const ranges: Array<[number, number]> = []
  SKIP_OPEN_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = SKIP_OPEN_RE.exec(html))) {
    const tag = match[1]
    if (!tag) continue
    const end = skippedBlockEnd(html, match.index, tag)
    ranges.push([match.index, end])
    SKIP_OPEN_RE.lastIndex = end
  }
  return ranges
}

function skippedBlockEnd(html: string, start: number, tag: string) {
  const name = tag.toLowerCase()
  const gt = html.indexOf('>', start)
  if (gt === -1) return html.length
  const openEnd = gt + 1
  if (name === 'svg' && html[gt - 1] === '/') return openEnd

  if (name === 'script' || name === 'style') {
    const close = new RegExp(`</${name}>`, 'i')
    close.lastIndex = openEnd
    const match = close.exec(html)
    return match ? match.index + match[0].length : html.length
  }

  let depth = 1
  const token = /<(\/?)svg\b[^>]*>/gi
  token.lastIndex = openEnd
  let match: RegExpExecArray | null
  while ((match = token.exec(html))) {
    if (match[1]) {
      depth--
      if (depth === 0) return match.index + match[0].length
    } else {
      depth++
    }
  }
  return html.length
}

function insideRange(index: number, ranges: Array<[number, number]>) {
  return ranges.some(([start, end]) => index >= start && index < end)
}
