// Narrow HTMLRewriter helpers for discovery-only extraction.
// Keep parser-sensitive component transforms in compose.ts.

export function extractHtmlTitle(html: string): string {
  let title = ''

  new HTMLRewriter()
    .on('title', {
      text(chunk) {
        title += chunk.text
      },
    })
    .transform(html)

  return title.trim()
}

export function extractHtmlDescription(html: string): string {
  let description = ''

  new HTMLRewriter()
    .on('meta[name="description"]', {
      element(el) {
        if (!description) description = el.getAttribute('content') ?? ''
      },
    })
    .transform(html)

  return description.trim()
}

export function scanHtmlInternalLinks(html: string): string[] {
  const links = new Set<string>()

  new HTMLRewriter()
    .on('a[href]', {
      element(el) {
        const href = el.getAttribute('href')
        if (!href || !href.startsWith('/')) return
        if (href.startsWith('//')) return
        const [path] = href.split(/["#?]/)
        if (path) links.add(path)
      },
    })
    .transform(html)

  return [...links]
}
