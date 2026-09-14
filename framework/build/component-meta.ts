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
// Unknown @tags and malformed @attr lines fail the build with file and line.

import type { ComponentSchema, SchemaAttr } from './compose'
import { BuildError, lineOf } from './errors'

const LEAD_COMMENT_RE = /^\s*<!--([\s\S]*?)-->\s*/
const ATTR_HEAD_RE = /^([A-Za-z_][\w-]*)(!?)(?:\s*=\[([^\]]*)\])?(?=$|\s)/
const ATTR_HINT = 'Use @attr name[!] [=[a|b]] [:class] description.'

export function parseInlineSchema(html: string, file?: string): { schema: ComponentSchema; html: string } {
  const m = html.match(LEAD_COMMENT_RE)
  if (!m) return { schema: {}, html }
  const block = m[1]
  const blockStart = m.index! + m[0].indexOf('<!--') + 4
  const schema: ComponentSchema = { attrs: {} }

  block.split('\n').forEach((rawLine, i) => {
    const line = rawLine.trim()
    if (!line.startsWith('@')) return
    const fail = (message: string, hint: string) => new BuildError(message, { file, line: lineOf(html, blockStart) + i, hint })
    const tag = line.split(/\s+/)[0]!
    const body = line.slice(tag.length).trim()

    if (tag === '@desc') {
      schema.description = body
      return
    }

    if (tag === '@attr') {
      const head = body.match(ATTR_HEAD_RE)
      if (!head) throw fail(`Malformed @attr "${body}"`, ATTR_HINT)
      const [matched, name, bang, enumList] = head
      let rest = body.slice(matched.length).trim()
      const attr: SchemaAttr = {}
      if (bang === '!') attr.required = true
      if (enumList !== undefined) attr.enum = enumList.split('|').map((s) => s.trim()).filter(Boolean)

      if (rest.startsWith(':class')) {
        attr.asClass = true
        rest = rest.slice(':class'.length).trim()
      }

      if (/^[!=:]/.test(rest)) throw fail(`Malformed @attr "${body}"`, ATTR_HINT)
      if (rest) attr.description = rest
      schema.attrs![name] = attr
      return
    }

    if (tag === '@schema') {
      const parts = body.split(/\s+/)
      const type = parts[0]
      const map: Record<string, string> = {}
      for (const pair of (parts[1] ?? '').split(',')) {
        const [k, v] = pair.split('=')
        if (k && v) map[k] = v
      }
      schema.schema = { type, map }
      return
    }

    throw fail(`Unknown contract tag "${tag}"`, 'Supported: @desc, @attr, @schema')
  })

  return { schema, html: html.slice(m[0].length) }
}
