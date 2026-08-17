const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'details', 'div', 'fieldset', 'figcaption', 'figure', 'footer',
  'form', 'header', 'main', 'nav', 'p', 'section', 'ul',
])

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
}

function text(value: string) {
  return decodeEntities(value.replace(/<[^>]+>/g, '')).replace(/[ \t]+/g, ' ').trim()
}

function attr(attrs: string, name: string) {
  return attrs.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1] ?? ''
}

function tableToMarkdown(body: string) {
  const rows = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
    [...row[1].matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((cell) => text(cell[2])),
  ).filter((row) => row.length)
  if (!rows.length) return ''
  const width = Math.max(...rows.map((row) => row.length))
  const normalized = rows.map((row) => [...row, ...Array(width - row.length).fill('')])
  const header = normalized[0]
  return `\n| ${header.join(' | ')} |\n| ${header.map(() => '---').join(' | ')} |\n${normalized.slice(1).map((row) => `| ${row.join(' | ')} |`).join('\n')}\n`
}

function listToMarkdown(body: string, ordered: boolean) {
  const items = [...body.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  return `\n${items.map((item, index) => `${ordered ? `${index + 1}.` : '-'} ${text(item[1])}`).join('\n')}\n`
}

/** Conservative, deterministic rendered-HTML to Markdown for agent-readable route alternates. */
export function htmlToMarkdown(html: string) {
  let out = html
    .replace(/<head\b[\s\S]*?<\/head>/gi, '')
    .replace(/<(script|style|template|svg)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_, body) => `\n\`\`\`\n${decodeEntities(body.replace(/^<code\b[^>]*>|<\/code>$/gi, '').trim())}\n\`\`\`\n`)
    .replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_, body) => tableToMarkdown(body))
    .replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_, body) => listToMarkdown(body, true))
    .replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, (_, body) => listToMarkdown(body, false))
    .replace(/<dl\b[^>]*>([\s\S]*?)<\/dl>/gi, (_, body) => body
      .replace(/<dt\b[^>]*>([\s\S]*?)<\/dt>/gi, (_match: string, term: string) => `\n**${text(term)}**\n`)
      .replace(/<dd\b[^>]*>([\s\S]*?)<\/dd>/gi, (_match: string, description: string) => `${text(description)}\n`))
    .replace(/<img\b([^>]*)>/gi, (_, attrs) => attr(attrs, 'src') ? `![${attr(attrs, 'alt')}](${attr(attrs, 'src')})` : '')
    .replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_, attrs, body) => {
      const label = text(body)
      const url = attr(attrs, 'href')
      return label && url ? `[${label}](${url})` : label
    })
    .replace(/<summary\b[^>]*>([\s\S]*?)<\/summary>/gi, (_, body) => `\n### ${text(body)}\n`)
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, body) => `\n${'#'.repeat(Number(level))} ${text(body)}\n`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n')
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, body) => `\`${text(body)}\``)
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, _tag, body) => `**${text(body)}**`)
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, _tag, body) => `*${text(body)}*`)

  out = out.replace(/<\/?([a-z][\w-]*)\b[^>]*>/gi, (_, tag) => BLOCK_TAGS.has(String(tag).toLowerCase()) ? '\n' : '')
  return decodeEntities(out)
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
