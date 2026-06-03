// RSS + JSON Feed generators. Posts only.

import { writeFile } from 'fs/promises'
import { join } from 'path'
import { absoluteUrl, type SiteConfig } from './seo'
import { publicPathFromSlug } from '../runtime/lib/paths.js'
import type { ContentRoute } from './content'

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

export async function writeFeeds(distDir: string, site: SiteConfig, posts: ContentRoute[]) {
  const sorted = [...posts].sort((a, b) => (b.data.date ?? '').localeCompare(a.data.date ?? ''))

  // RSS 2.0
  const items = sorted.map((p) => {
    const url = absoluteUrl(site.url, publicPathFromSlug(p.slug))
    const pub = p.data.date ? new Date(p.data.date).toUTCString() : new Date().toUTCString()
    return `    <item>
      <title>${esc(p.data.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <pubDate>${pub}</pubDate>
      <description>${esc(p.data.description ?? '')}</description>
    </item>`
  }).join('\n')

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(site.name)}</title>
    <link>${site.url}</link>
    <description>${esc(site.description)}</description>
    <language>${site.locale ?? 'en'}</language>
${items}
  </channel>
</rss>
`
  await writeFile(join(distDir, 'feed.xml'), rss)

  // JSON Feed 1.1
  const jf = {
    version: 'https://jsonfeed.org/version/1.1',
    title: site.name,
    home_page_url: site.url,
    feed_url: absoluteUrl(site.url, '/feed.json'),
    description: site.description,
    language: site.locale ?? 'en',
    items: sorted.map((p) => ({
      id: absoluteUrl(site.url, publicPathFromSlug(p.slug)),
      url: absoluteUrl(site.url, publicPathFromSlug(p.slug)),
      title: p.data.title,
      content_text: p.markdown,
      summary: p.data.description ?? '',
      date_published: p.data.date ? new Date(p.data.date).toISOString() : new Date().toISOString(),
      tags: p.tags,
    })),
  }
  await writeFile(join(distDir, 'feed.json'), JSON.stringify(jf, null, 2))
}
