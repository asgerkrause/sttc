import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { dist, src } from './paths'
import { createComposer } from './compose'
import { slugifyTag, type ContentRoute } from './content'
import type { RouteRecord } from './discovery'

function escapeHtmlBasic(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

function postLinkList(posts: ContentRoute[]) {
  return posts
    .sort((a, b) => (b.data.date ?? '').localeCompare(a.data.date ?? ''))
    .map((p) => `
  <article class="post-item">
    <h2 class="post-item-title"><a href="/${p.slug}/">${escapeHtmlBasic(p.data.title)}</a></h2>
    <p class="post-item-meta"><time datetime="${p.data.date ?? ''}">${p.data.date ?? ''}</time></p>
    <p class="post-item-desc">${escapeHtmlBasic(p.data.description ?? '')}</p>
  </article>`)
    .join('\n')
}

export async function autoGenerateIndexes(
  composer: ReturnType<typeof createComposer>,
  posts: ContentRoute[],
  routeRecords: RouteRecord[],
  routeSlugs: string[],
) {
  if (!posts.length) return

  const insightsExists = await Bun.file(join(src, 'routes', 'insights.html')).exists()
  if (!insightsExists) {
    const body = `<head>
  <SEO title="Insights" description="All posts." path="/insights/" />
</head>
<Section>
  <h1>Insights</h1>
  ${postLinkList(posts)}
</Section>`
    const html = await composer.prepareRouteSource(body, 'insights.html')
    await mkdir(join(dist, 'routes'), { recursive: true })
    await writeFile(join(dist, 'routes', 'insights.html'), html)
    routeSlugs.push('insights')
    routeRecords.push({
      slug: 'insights',
      title: 'Insights',
      description: 'All posts.',
      components: [],
      internalLinks: posts.map((p) => `/${p.slug}/`),
      schemas: ['CollectionPage'],
      lastModified: new Date().toISOString(),
    })
  }

  const byTag = new Map<string, { label: string; posts: ContentRoute[] }>()
  for (const p of posts) {
    for (const t of p.tags) {
      const slug = slugifyTag(t)
      if (!slug) continue
      if (!byTag.has(slug)) byTag.set(slug, { label: t, posts: [] })
      byTag.get(slug)!.posts.push(p)
    }
  }
  if (byTag.size === 0) return

  for (const [tagSlug, group] of byTag) {
    const { label, posts: postsForTag } = group
    const body = `<head>
  <SEO title="Tag: ${label}" description="Posts tagged ${label}." path="/tags/${tagSlug}/" />
</head>
<Section>
  <h1>Tag: <code>${label}</code></h1>
  ${postLinkList(postsForTag)}
  <p><a href="/tags/">← All tags</a></p>
</Section>`
    const html = await composer.prepareRouteSource(body, `tags/${tagSlug}.html`)
    await mkdir(join(dist, 'routes', 'tags'), { recursive: true })
    await writeFile(join(dist, 'routes', 'tags', `${tagSlug}.html`), html)
    routeSlugs.push(`tags/${tagSlug}`)
    routeRecords.push({
      slug: `tags/${tagSlug}`,
      title: `Tag: ${label}`,
      description: `Posts tagged ${label}.`,
      components: [],
      internalLinks: postsForTag.map((p) => `/${p.slug}/`),
      schemas: ['CollectionPage'],
      lastModified: new Date().toISOString(),
    })
  }

  const tagLinks = [...byTag.entries()]
    .sort(([, a], [, b]) => a.label.localeCompare(b.label))
    .map(([slug, group]) => `<li><a href="/tags/${slug}/">${group.label}</a> <small>(${group.posts.length})</small></li>`)
    .join('\n  ')
  const body = `<head>
  <SEO title="Tags" description="All tags." path="/tags/" />
</head>
<Section>
  <h1>Tags</h1>
  <ul>
  ${tagLinks}
  </ul>
</Section>`
  const html = await composer.prepareRouteSource(body, 'tags.html')
  await writeFile(join(dist, 'routes', 'tags.html'), html)
  routeSlugs.push('tags')
  routeRecords.push({
    slug: 'tags',
    title: 'Tags',
    description: 'All tags.',
    components: [],
    internalLinks: [...byTag.keys()].map((t) => `/tags/${t}/`),
    schemas: ['CollectionPage'],
    lastModified: new Date().toISOString(),
  })
}
