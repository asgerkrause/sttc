import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { dist } from './paths'
import { createComposer } from './compose'
import { slugifyTag, type ContentRoute } from './content'
import type { RouteRecord } from './discovery'
import type { RouteRegistry } from './routes'

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
  routeRegistry: RouteRegistry,
) {
  if (!posts.length) return

  const insightsBody = `<head>
  <SEO title="Insights" description="All posts." path="/insights/" />
</head>
<Section>
  <h1>Insights</h1>
  ${postLinkList(posts)}
</Section>`
  const insightsRoute = routeRegistry.register({ slug: 'insights', kind: 'generated', source: 'generated:insights' })
  const insightsHtml = await composer.prepareRouteSource(insightsBody, insightsRoute.outFile)
  await mkdir(join(dist, 'routes'), { recursive: true })
  await writeFile(join(dist, 'routes', insightsRoute.outFile), insightsHtml)
  routeRecords.push({
    slug: 'insights',
    title: 'Insights',
    description: 'All posts.',
    components: [],
    internalLinks: posts.map((p) => `/${p.slug}/`),
    schemas: ['CollectionPage'],
    lastModified: new Date().toISOString(),
  })

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
    const slug = `tags/${tagSlug}`
    const registered = routeRegistry.register({ slug, kind: 'generated', source: `generated:${slug}` })
    const html = await composer.prepareRouteSource(body, registered.outFile)
    await mkdir(join(dist, 'routes', 'tags'), { recursive: true })
    await writeFile(join(dist, 'routes', registered.outFile), html)
    routeRecords.push({
      slug,
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
  const registered = routeRegistry.register({ slug: 'tags', kind: 'generated', source: 'generated:tags' })
  const html = await composer.prepareRouteSource(body, registered.outFile)
  await writeFile(join(dist, 'routes', registered.outFile), html)
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
