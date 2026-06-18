// Compiles content/posts/*.md → src/routes/insights/{slug}.html (in-memory)
// and content/pages/*.md → src/routes/{slug}.html (in-memory).
// Templates live in src/templates/{post,page}.html and use {{title}}, {{body}}, {{date}}, etc.

import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'
import { BuildError, lineOf } from './errors'
import { fmString, fmStringArray, parseFrontMatter, render as renderMarkdown } from './markdown'
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
  /** Display labels parsed from front-matter `tags: [a, b]`; route slugs are derived with slugifyTag. */
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

export function slugifyTag(tag: string) {
  return tag
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function normalizeContentTags(tags: string[]) {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of tags) {
    const label = raw.trim()
    const slug = slugifyTag(label)
    if (!label || !slug || seen.has(slug)) continue
    seen.add(slug)
    out.push(label)
  }
  return out
}

function escapeAttr(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

function normalizeContentMediaRefs(value: string) {
  return value.replace(/\/(?:media|assets)\/images\/([^\s)"']+)\.(jpe?g|png|webp)\b/gi, (_m, name) => {
    return `/assets/images/${name}.webp`
  })
}

function markdownBodyStart(raw: string) {
  return raw.match(/^---\n[\s\S]*?\n---\n?/)?.[0].length ?? 0
}

export function assertSafeContentMarkdown(raw: string, file: string) {
  const bodyStart = markdownBodyStart(raw)
  const body = raw.slice(bodyStart)
  const unsafe = body.match(/<\s*\/?\s*(script|style)\b/i)
  if (!unsafe || unsafe.index == null) return
  const tag = unsafe[1].toLowerCase()
  throw new BuildError(`Unsafe <${tag}> tag in CMS markdown`, {
    file,
    line: lineOf(raw, bodyStart + unsafe.index),
    hint: `Remove <${tag}> from markdown. Put scripts in src/app/app.js and styles in component <style> blocks.`,
  })
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

  if (!fmString(data, 'title')) {
    throw new BuildError(`content/${collection}/${filename} missing "title" in front-matter`, {
      file: `content/${collection}/${filename}`,
    })
  }

  const sourceRel = `content/${collection}/${filename}`
  assertSafeContentMarkdown(raw, sourceRel)
  const normalizedBody = normalizeContentMediaRefs(body)
  const html = renderMarkdown(normalizedBody, { file: sourceRel })
  const frontMatterTags = fmStringArray(data, 'tags')
  const tags = normalizeContentTags(frontMatterTags.length ? frontMatterTags : parseTags(fmString(data, 'tags')))
  const draft = fmString(data, 'draft') === 'true' || fmString(data, 'draft') === '1'
  const flat: Record<string, string> = {}
  for (const [k, v] of Object.entries(data)) {
    flat[k] = normalizeContentMediaRefs(typeof v === 'string' ? v : v == null ? '' : JSON.stringify(v))
  }
  const vars: Record<string, string> = {
    ...flat,
    title: fmString(data, 'title'),
    slug,
    basename,
    body: html,
    tagsHtml: tags.map((t) => `<Tag href="/tags/${slugifyTag(t)}/" label="${escapeAttr(t)}" />`).join(' '),
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
    source: sourceRel,
    data: flat,
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
