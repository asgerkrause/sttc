// Narrow HTMLRewriter helpers for discovery-only extraction.
// Keep parser-sensitive component transforms in compose.ts.

function schemaTypeName(value: string | null) {
  if (!value) return undefined
  const match = value.match(/(?:https?:\/\/schema\.org\/|^)([A-Za-z][A-Za-z0-9]*)$/)
  return match?.[1]
}

export function extractHtmlMetadata(html: string) {
  let title = ''
  let description = ''
  const links = new Set<string>()
  const schemas = new Set<string>()

  new HTMLRewriter()
    .on('title', {
      text(chunk) {
        title += chunk.text
      },
    })
    .on('meta[name="description"]', {
      element(el) {
        if (!description) description = el.getAttribute('content') ?? ''
      },
    })
    .on('[itemtype]', {
      element(el) {
        const type = schemaTypeName(el.getAttribute('itemtype'))
        if (type) schemas.add(type)
      },
    })
    .on('a[href]', {
      element(el) {
        const href = el.getAttribute('href')
        if (!href || !href.startsWith('/') || href.startsWith('//')) return
        const [path] = href.split(/["#?]/)
        if (path) links.add(path)
      },
    })
    .transform(html)

  return { title: title.trim(), description: description.trim(), internalLinks: [...links], schemas: [...schemas] }
}

export function extractHtmlTitle(html: string): string {
  return extractHtmlMetadata(html).title
}

export function extractHtmlDescription(html: string): string {
  return extractHtmlMetadata(html).description
}

export function scanHtmlInternalLinks(html: string): string[] {
  return extractHtmlMetadata(html).internalLinks
}
