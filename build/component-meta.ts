// Parses the leading HTML comment of a component file and returns ComponentSchema.
// Comment must be the very first non-whitespace content in the file.
//
// Format:
//   <!--
//     @desc One-line description.
//     @attr name[!] [=enum] [:class] description
//     @schema TypeName field=attr,field=attr
//   -->
//
// Where:
//   `!` after attr name → required (build throws on missing)
//   `=[a|b|c]` → enum constraint (build throws on unknown value)
//   `:class` → value appended as a class on the template root
//
// Unknown @tags are silently ignored so the format can grow without breaking old files.

import type { ComponentSchema, SchemaAttr } from './compose'

const LEAD_COMMENT_RE = /^\s*<!--([\s\S]*?)-->\s*/

export function parseInlineSchema(html: string): { schema: ComponentSchema; html: string } {
  const m = html.match(LEAD_COMMENT_RE)
  if (!m) return { schema: {}, html }
  const block = m[1]
  const schema: ComponentSchema = { attrs: {} }

  for (const rawLine of block.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith('@desc ')) {
      schema.description = line.slice(6).trim()
      continue
    }

    if (line.startsWith('@attr ')) {
      const body = line.slice(6).trim()
      const nameMatch = body.match(/^([A-Za-z_][\w-]*)(!?)/)
      if (!nameMatch) continue
      const [head, name, bang] = nameMatch
      let rest = body.slice(head.length).trim()
      const attr: SchemaAttr = {}
      if (bang === '!') attr.required = true

      const enumMatch = rest.match(/^=\[([^\]]+)\]/)
      if (enumMatch) {
        attr.enum = enumMatch[1].split('|').map((s) => s.trim()).filter(Boolean)
        rest = rest.slice(enumMatch[0].length).trim()
      }

      if (rest.startsWith(':class')) {
        attr.asClass = true
        rest = rest.slice(':class'.length).trim()
      }

      if (rest) attr.description = rest
      schema.attrs![name] = attr
      continue
    }

    if (line.startsWith('@schema ')) {
      const parts = line.slice(8).trim().split(/\s+/)
      const type = parts[0]
      const map: Record<string, string> = {}
      for (const pair of (parts[1] ?? '').split(',')) {
        const [k, v] = pair.split('=')
        if (k && v) map[k] = v
      }
      schema.schema = { type, map }
      continue
    }
  }

  return { schema, html: html.slice(m[0].length) }
}
