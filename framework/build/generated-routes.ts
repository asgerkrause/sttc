import { readFile } from 'fs/promises'
import { join } from 'path'
import type { ContentRoute } from './content'
import { slugify } from './markdown'
import type { RouteGraph } from './route-graph'
import { escapeHtml } from './html'
import { src } from './paths'
import { html as safeHtml, renderTemplate, type TemplateContext } from './template-directives'

export type GeneratedRouteOptions = {
  /** Project src directory; optional src/templates/posts-index.html and tags.html override the default markup. */
  srcDir?: string
  /** Posts collection route pattern, e.g. insights/{slug}. The index lives at its prefix. */
  route?: string
}

function sortedPosts(posts: ContentRoute[]) {
  return [...posts].sort((a, b) => (b.data.date ?? '').localeCompare(a.data.date ?? ''))
}

function postLinkList(posts: ContentRoute[]) {
  return sortedPosts(posts)
    .map((p) => `
  <article class="post-item">
    <h2 class="post-item-title"><a href="/${p.slug}/">${escapeHtml(p.data.title)}</a></h2>
    <p class="post-item-meta"><time datetime="${p.data.date ?? ''}">${p.data.date ?? ''}</time></p>
    <p class="post-item-desc">${escapeHtml(p.data.description ?? '')}</p>
  </article>`)
    .join('\n')
}

/** Renders src/templates/{name} with the project's placeholders, or the renderer default when absent. */
async function renderGenerated(srcDir: string, name: string, vars: TemplateContext, fallback: string) {
  const file = `src/templates/${name}`
  const template = await readFile(join(srcDir, 'templates', name), 'utf8').catch(() => undefined)
  if (template === undefined) return fallback
  return renderTemplate(template, vars, { allowEach: true, placeholders: true, preserveUnknownPlaceholders: true, file })
}

function postItems(posts: ContentRoute[]) {
  return sortedPosts(posts).map((p) => ({
    ...p.data,
    slug: p.slug,
    path: `/${p.slug}/`,
    tags: p.tags,
  }))
}

export async function autoGenerateIndexes(
  routeGraph: RouteGraph,
  posts: ContentRoute[],
  options: GeneratedRouteOptions = {},
) {
  if (!posts.length) return
  const srcDir = options.srcDir ?? src
  // The index lives at the literal prefix before {slug}: blog/{slug}/entry indexes at /blog/.
  const indexSlug = (options.route ?? 'insights/{slug}').split('{slug}')[0]!.replace(/^\/+|\/+$/g, '')
  // ponytail: a posts route of "{slug}" has no index prefix; the home page stays authored.
  if (indexSlug) {
    const path = `/${indexSlug}/`
    const body = await renderGenerated(srcDir, 'posts-index.html', {
      title: 'Insights',
      path,
      items: safeHtml(postLinkList(posts)),
      posts: postItems(posts),
    }, `<head>
  <SEO title="Insights" description="All posts." path="${path}" />
</head>
<Section>
  <h1>Insights</h1>
  ${postLinkList(posts)}
</Section>`)
    await routeGraph.compose(
      { slug: indexSlug, kind: 'generated', source: 'generated:posts-index' },
      body,
      { schemas: ['CollectionPage'] },
    )
  }

  const byTag = new Map<string, { label: string; posts: ContentRoute[] }>()
  for (const p of posts) {
    for (const t of p.tags) {
      const slug = slugify(t)
      if (!slug) continue
      if (!byTag.has(slug)) byTag.set(slug, { label: t, posts: [] })
      byTag.get(slug)!.posts.push(p)
    }
  }
  if (byTag.size === 0) return

  for (const [tagSlug, group] of byTag) {
    const { label, posts: postsForTag } = group
    const safeLabel = escapeHtml(label)
    const slug = `tags/${tagSlug}`
    const body = await renderGenerated(srcDir, 'tags.html', {
      tag: label,
      path: `/${slug}/`,
      items: safeHtml(postLinkList(postsForTag)),
      posts: postItems(postsForTag),
    }, `<head>
  <SEO title="Tag: ${safeLabel}" description="Posts tagged ${safeLabel}." path="/tags/${tagSlug}/" />
</head>
<Section>
  <h1>Tag: <code>${safeLabel}</code></h1>
  ${postLinkList(postsForTag)}
  <p><a href="/tags/">← All tags</a></p>
</Section>`)
    await routeGraph.compose(
      { slug, kind: 'generated', source: `generated:tag:${tagSlug}` },
      body,
      { schemas: ['CollectionPage'] },
    )
  }

  const tagLinks = [...byTag.entries()]
    .sort(([, a], [, b]) => a.label.localeCompare(b.label))
    .map(([slug, group]) => `<li><a href="/tags/${slug}/">${escapeHtml(group.label)}</a> <small>(${group.posts.length})</small></li>`)
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
    { slug: 'tags', kind: 'generated', source: 'generated:tags-index' },
    body,
    { schemas: ['CollectionPage'] },
  )
}
