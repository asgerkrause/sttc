import { slugifyTag, type ContentRoute } from './content'
import type { RouteGraph } from './route-graph'

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
  routeGraph: RouteGraph,
  posts: ContentRoute[],
) {
  if (!posts.length) return

  const insightsBody = `<head>
  <SEO title="Insights" description="All posts." path="/insights/" />
</head>
<Section>
  <h1>Insights</h1>
  ${postLinkList(posts)}
</Section>`
  await routeGraph.compose(
    { slug: 'insights', kind: 'generated', source: 'generated:insights' },
    insightsBody,
    { schemas: ['CollectionPage'] },
  )

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
    await routeGraph.compose(
      { slug, kind: 'generated', source: `generated:${slug}` },
      body,
      { schemas: ['CollectionPage'] },
    )
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
  await routeGraph.compose(
    { slug: 'tags', kind: 'generated', source: 'generated:tags' },
    body,
    { schemas: ['CollectionPage'] },
  )
}
