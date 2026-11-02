// Single source of truth for component-tag parsing at build time.
// Replaces build/attrs.ts and the various COMPONENT_TAG_RE / IMAGE_TAG_RE / SEO regexes
// that used to live scattered across compose.ts and scan-images.ts.

import { buildErrorAt, BuildError, lineOf } from './errors'

// `<Component attr="value" flag />` — PascalCase only. The tag is matched loosely (anything up to
// `>`, quotes respected) so a malformed attribute list is an error, not silently passed through.
const LOOSE_ATTRS = '((?:"[^"]*"|[^>"])*?)(/?)'
export const COMPONENT_OPEN_RE = new RegExp(`<([A-Z][A-Za-z0-9]*)\\b${LOOSE_ATTRS}>`, 'g')
const STRICT_ATTRS_RE = /^(?:\s+[\w-]+(?:="[^"]*")?)*\s*$/
const ATTR_PAIR_RE = /([\w-]+)(?:="([^"]*)")?/g

export type ComponentMatch = {
  full: string
  name: string
  attrs: Record<string, string>
  selfClosing: boolean
  /** Index into the source string. */
  index: number
  /** Children string if this is a paired open/close tag (e.g. `<Card>...</Card>`). Empty if self-closing. */
  children: string
}

export function parseAttrs(attrPart: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of attrPart.matchAll(ATTR_PAIR_RE)) {
    out[m[1]] = m[2] ?? '1' // boolean attrs collapse to '1'
  }
  return out
}

/**
 * Find the next component invocation in `html`, supporting both self-closing
 * (`<Card />`) and paired (`<Card>children</Card>`) forms. Returns null if none.
 */
export function nextComponent(html: string, from = 0, fileHint?: string): ComponentMatch | null {
  COMPONENT_OPEN_RE.lastIndex = from
  const m = COMPONENT_OPEN_RE.exec(html)
  if (!m) return null
  const [full, name, attrPart, slash] = m
  if (!STRICT_ATTRS_RE.test(attrPart)) {
    throw buildErrorAt(`<${name} /> has malformed attributes: ${full}`, html, m.index, {
      file: fileHint,
      hint: 'Write attributes as name="value" with double quotes, or as a bare flag.',
    })
  }
  const attrs = parseAttrs(attrPart)
  const openEnd = m.index + full.length

  if (slash === '/') {
    return { full, name, attrs, selfClosing: true, index: m.index, children: '' }
  }

  const close = pairedClose(html, name, openEnd)
  if (!close) {
    throw new BuildError(`Unclosed <${name}> tag`, {
      file: fileHint,
      line: lineOf(html, m.index),
      hint: `Either close with </${name}> or use the self-closing form <${name} ... />`,
    })
  }
  const children = html.slice(openEnd, close.index)
  const fullPair = html.slice(m.index, close.index + close.length)
  return { full: fullPair, name, attrs, selfClosing: false, index: m.index, children }
}

/**
 * Find the `</name>` that closes an open tag ending at `openEnd`, skipping nested same-name pairs.
 * Returns null when the tag is never closed.
 */
export function pairedClose(html: string, name: string, openEnd: number): { index: number; length: number } | null {
  const closeRe = new RegExp(`</${name}>`, 'g')
  const openRe = new RegExp(`<${name}\\b${LOOSE_ATTRS}>`, 'g')
  let depth = 1
  let pos = openEnd
  while (depth > 0) {
    closeRe.lastIndex = pos
    const close = closeRe.exec(html)
    if (!close) return null
    openRe.lastIndex = pos
    let open = openRe.exec(html)
    while (open && open.index < close.index) {
      if (open[2] !== '/') depth++
      pos = open.index + open[0].length
      openRe.lastIndex = pos
      open = openRe.exec(html)
    }
    depth--
    if (depth === 0) return { index: close.index, length: close[0].length }
    pos = close.index + close[0].length
  }
  return null
}


