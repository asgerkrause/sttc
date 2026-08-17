// Single source of truth for component-tag parsing at build time.
// Replaces build/attrs.ts and the various COMPONENT_TAG_RE / IMAGE_TAG_RE / SEO regexes
// that used to live scattered across compose.ts and scan-images.ts.

import { BuildError, lineOf } from './errors'

// `<Component attr="value" flag />` — PascalCase only.
const ATTRS_GROUP = '(?:\\s+(?:[\\w-]+(?:="[^"]*")?))*'
export const COMPONENT_OPEN_RE = new RegExp(`<([A-Z][A-Za-z0-9]*)(${ATTRS_GROUP})\\s*(/?)>`, 'g')
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
  const attrs = parseAttrs(attrPart)
  const openEnd = m.index + full.length

  if (slash === '/') {
    return { full, name, attrs, selfClosing: true, index: m.index, children: '' }
  }

  // Paired form: find matching `</Name>`, respecting nesting of same-name opens.
  const closeRe = new RegExp(`</${name}>`, 'g')
  const openRe = new RegExp(`<${name}(?:${ATTRS_GROUP})\\s*>`, 'g')
  closeRe.lastIndex = openEnd
  openRe.lastIndex = openEnd

  let depth = 1
  let pos = openEnd
  while (depth > 0) {
    closeRe.lastIndex = pos
    const close = closeRe.exec(html)
    if (!close) {
      throw new BuildError(`Unclosed <${name}> tag`, {
        file: fileHint,
        line: lineOf(html, m.index),
        hint: `Either close with </${name}> or use the self-closing form <${name} ... />`,
      })
    }
    openRe.lastIndex = pos
    let open = openRe.exec(html)
    while (open && open.index < close.index) {
      depth++
      pos = open.index + open[0].length
      openRe.lastIndex = pos
      open = openRe.exec(html)
    }
    depth--
    if (depth === 0) {
      const children = html.slice(openEnd, close.index)
      const fullPair = html.slice(m.index, close.index + close[0].length)
      return { full: fullPair, name, attrs, selfClosing: false, index: m.index, children }
    }
    pos = close.index + close[0].length
  }
  return null
}


