// Compiles content/posts/*.md → src/routes/insights/{slug}.html (in-memory)
// and content/pages/*.md → src/routes/{slug}.html (in-memory).
// Templates live in src/templates/{post,page}.html and use {{title}}, {{body}}, {{date}}, etc.

import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'
import { BuildError } from './errors'
import { parseFrontMatter, render as renderMarkdown } from './markdown'
import { root, src } from './paths'

export type ContentRoute = {
  slug: string
  /** Path under dist/routes/ for the resulting .html, e.g. "insights/intro.html" */
  routeFile: string
  /** Final HTML body (with <head> SEO and composed components stripped — same shape as src/routes files). */
  body: string
  /** Source path (for error messages). */
  source: string
  /** Front-matter data (title, date, description, hero, etc.) */
  data: Record<string, string>
  /** Collection name. */
  collection: 'posts' | 'pages'
  /** Raw markdown body (for llms-full.txt). */
  markdown: string
  /** Parsed tags from front-matter `tags: [a, b]`. */
  tags: string[]
  /** Draft flag — excluded from prod. Always built in dev with a banner. */
  draft: boolean
}

async function exists(p: string) {
  try { await stat(p); return true } catch { return false }
}

async function loadTemplate(name: string): Promise<string> {
  const path = join(src, 'templates', name)
  if (!(await exists(path))) {
    throw new BuildError(`Missing template ${path}`, {
      file: `src/templates/${name}`,
      hint: `Create src/templates/${name} — it's used to render compiled content.`,
    })
  }
  return readFile(path, 'utf8')
}

function substitute(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (m, key) => vars[key] ?? m)
}

async function compileFile(
  collection: 'posts' | 'pages',
  filename: string,
  template: string,
): Promise<ContentRoute> {
  const dir = join(root, 'content', collection)
  const fullPath = join(dir, filename)
  const raw = await readFile(fullPath, 'utf8')
  const { data, body } = parseFrontMatter(raw)
  const basename = filename.replace(/\.md$/i, '')
  const slug = collection === 'posts' ? `insights/${basename}` : basename

  if (!data.title) {
    throw new BuildError(`content/${collection}/${filename} missing "title" in front-matter`, {
      file: `content/${collection}/${filename}`,
    })
  }

  const html = renderMarkdown(body)
  const tags = parseTags(data.tags)
  const draft = data.draft === 'true' || data.draft === '1'
  const vars: Record<string, string> = {
    ...data,
    slug,
    basename,
    body: html,
    tagsHtml: tags.map((t) => `<Tag href="/tags/${t}/" label="${t}" />`).join(' '),
  }
  let composed = substitute(template, vars)
  if (draft && process.env.SNZ_DEV) {
    composed = composed.replace(/(<article[^>]*>)/, '$1\n<aside class="draft-banner">Draft — not in production build</aside>')
  }

  const routeFile = `${slug}.html`
  return {
    slug,
    routeFile,
    body: composed,
    source: `content/${collection}/${filename}`,
    data,
    collection,
    markdown: body,
    tags,
    draft,
  }
}

function parseTags(raw: string | undefined): string[] {
  if (!raw) return []
  // Supports `tags: [a, b]` or `tags: a, b`
  const inner = raw.replace(/^\[|\]$/g, '')
  return inner.split(',').map((t) => t.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
}

export async function compileContent(): Promise<ContentRoute[]> {
  const includeDrafts = !!process.env.SNZ_DEV
  const out: ContentRoute[] = []
  for (const collection of ['posts', 'pages'] as const) {
    const dir = join(root, 'content', collection)
    if (!(await exists(dir))) continue
    let files: string[]
    try {
      files = (await readdir(dir)).filter((f) => f.endsWith('.md'))
    } catch { continue }
    if (files.length === 0) continue
    const tplName = collection === 'posts' ? 'post.html' : 'page.html'
    const template = await loadTemplate(tplName)
    for (const f of files) {
      const route = await compileFile(collection, f, template)
      if (route.draft && !includeDrafts) continue
      out.push(route)
    }
  }
  return out
}
