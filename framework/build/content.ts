// Compiles built-in posts and optional custom markdown collections into in-memory routes.
// Built-in stays implicit:
// - content/posts/*.md → /insights/{slug}/ through src/templates/post.html
// Custom collections come from content/collections.json.

import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'
import { BuildError, lineOf } from './errors'
import { fmString, fmStringArray, parseFrontMatter, render as renderMarkdown } from './markdown'
import { root, src } from './paths'
import { html as safeHtml, renderTemplate, type TemplateContext, type TemplateValue } from './template-directives'

export type ContentFieldConfig = {
  name: string
  type?: string
  required?: boolean
  [key: string]: unknown
}

export type ContentCollectionConfig = {
  name: string
  label?: string
  path: string
  template: string
  route: string
  required: string[]
  fields?: ContentFieldConfig[]
  builtin?: 'posts'
}

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
  /** Normalized ISO date for built-in posts. */
  date?: string
  /** Collection name. */
  collection: string
  /** Raw markdown body (for llms-full.txt). */
  markdown: string
  /** Display labels parsed from front-matter `tags: [a, b]`; route slugs are derived with slugifyTag. */
  tags: string[]
  /** Draft flag — excluded from prod. Always built in dev with a banner. */
  draft: boolean
}

const BUILTIN_COLLECTIONS: ContentCollectionConfig[] = [
  {
    name: 'posts',
    path: 'content/posts',
    template: 'post.html',
    route: 'insights/{slug}',
    required: ['title'],
    builtin: 'posts',
  },
]

async function exists(p: string) {
  try { await stat(p); return true } catch { return false }
}

async function markdownFiles(dir: string) {
  try {
    return (await readdir(dir)).filter((f) => f.endsWith('.md')).sort()
  } catch {
    return []
  }
}

async function loadTemplate(srcDir: string, name: string): Promise<string> {
  const path = join(srcDir, 'templates', name)
  if (!(await exists(path))) {
    throw new BuildError(`Missing template ${path}`, {
      file: `src/templates/${name}`,
      hint: `Create src/templates/${name} — it's used to render compiled content.`,
    })
  }
  return readFile(path, 'utf8')
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
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


const CONTENT_MEDIA_REF_RE = /\/(?:src|assets)\/images\/([^\s)"']+)/gi
const CONTENT_MEDIA_EXT_RE = /\.(jpe?g|png|webp)$/i

function normalizeContentMediaRefs(value: string) {
  return value.replace(CONTENT_MEDIA_REF_RE, (match, file) => {
    if (!CONTENT_MEDIA_EXT_RE.test(file)) return match
    const name = file.split('/').pop()!.replace(CONTENT_MEDIA_EXT_RE, '')
    return `/assets/images/${name}.webp`
  })
}

function normalizeContentTemplateValue(value: unknown, file: string, source: string): TemplateValue {
  if (typeof value === 'string') {
    assertValidContentMediaRefs(value, file, source, Math.max(0, source.indexOf(value)))
    return normalizeContentMediaRefs(value)
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) return value as TemplateValue
  if (Array.isArray(value)) return value.map((item) => normalizeContentTemplateValue(item, file, source))
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeContentTemplateValue(item, file, source)])) as TemplateValue
  }
  return String(value)
}

function assertValidContentMediaRefs(value: string, file: string, source: string, offset = 0) {
  for (const match of value.matchAll(CONTENT_MEDIA_REF_RE)) {
    const ref = match[0]
    const image = match[1]
    if (CONTENT_MEDIA_EXT_RE.test(image)) continue
    throw new BuildError(`Unsupported CMS media reference "${ref}"`, {
      file,
      line: lineOf(source, offset + (match.index ?? 0)),
      hint: 'Use /src/images/name.jpg, .png, or .webp. CMS media is optimized to /assets/images/name.webp at build time.',
    })
  }
}

function assertNoFrontMatterSlug(data: Record<string, unknown>, file: string, source: string) {
  if (data.slug == null) return
  throw new BuildError(`${file} uses unsupported front-matter "slug"`, {
    file,
    line: lineOf(source, source.indexOf('slug:')),
    hint: 'Rename the markdown file instead. Filename basename is the URL slug.',
  })
}

function markdownBodyStart(raw: string) {
  return raw.match(/^---\n[\s\S]*?\n---\n?/)?.[0].length ?? 0
}

function frontMatterFieldLine(raw: string, field: string) {
  const frontMatterMatch = raw.match(/^---\n([\s\S]*?)\n---/)
  const frontMatter = frontMatterMatch?.[1]
  if (!frontMatter) return undefined
  const match = frontMatter.match(new RegExp(`(^|\\n)${field}:`, 'm'))
  if (match?.index === undefined) return undefined
  const bodyOffset = frontMatterMatch![0].indexOf(frontMatter)
  return lineOf(raw, bodyOffset + match.index + (match[1] === '\n' ? 1 : 0))
}

function assertPostDate(data: Record<string, unknown>, file: string, raw: string) {
  const value = fmString(data, 'date').trim()
  if (!value) {
    throw new BuildError(`${file} missing "date" in front-matter`, {
      file,
      line: 1,
      hint: 'Add date: YYYY-MM-DD. Built-in posts need stable feed and BlogPosting dates.',
    })
  }

  const parsed = new Date(value)
  if (!Number.isFinite(parsed.valueOf())) {
    throw new BuildError(`${file} has invalid "date" in front-matter`, {
      file,
      line: frontMatterFieldLine(raw, 'date') ?? 1,
      hint: 'Use date: YYYY-MM-DD or a valid ISO date.',
    })
  }

  const iso = parsed.toISOString()
  const datePart = value.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s].*)?$/)?.[1]
  if (datePart && iso.slice(0, 10) !== datePart) {
    throw new BuildError(`${file} has invalid "date" in front-matter`, {
      file,
      line: frontMatterFieldLine(raw, 'date') ?? 1,
      hint: 'Use a real calendar date like 2026-05-26.',
    })
  }

  return iso
}

export function assertSafeContentMarkdown(raw: string, file: string) {
  const bodyStart = markdownBodyStart(raw)
  const body = raw.slice(bodyStart)
  const unsafe = body.match(/<\s*\/?\s*(script|style)\b/i)
  if (!unsafe || unsafe.index == null) return
  const tag = unsafe[1]?.toLowerCase()
  if (!tag) return
  throw new BuildError(`Unsafe <${tag}> tag in CMS markdown`, {
    file,
    line: lineOf(raw, bodyStart + unsafe.index),
    hint: `Remove <${tag}> from markdown. Put scripts in src/app.ts and styles in component <style> blocks.`,
  })
}

function configError(message: string, hint?: string): never {
  throw new BuildError(message, {
    file: 'content/collections.json',
    hint,
  })
}

function normalizeContentPath(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) configError('Custom collection path must be a non-empty string')
  const rel = value.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/g, '')
  const parts = rel.split('/').filter(Boolean)
  if (!parts.length || rel.startsWith('/') || parts.includes('..') || parts.includes('.')) {
    configError('Custom collection path must be a safe repo-relative path', 'Use paths like content/projects. Path traversal and absolute paths are not allowed.')
  }
  const normalized = parts.join('/')
  if (!normalized.startsWith('content/') || normalized === 'content/posts' || normalized === 'content/pages') {
    configError('Custom collection path must be a non-built-in content subfolder', 'Use paths like content/projects. content/pages is reserved; authored pages belong in src/pages.')
  }
  return normalized
}

function normalizeTemplate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) configError('Custom collection template must be a non-empty string')
  const template = value.trim()
  if (template.includes('/') || template.includes('\\') || template.includes('..') || !template.endsWith('.html')) {
    configError('Custom collection template must be an .html file in src/templates/', 'Use a filename like project.html, with no path segments.')
  }
  return template
}

function normalizeRoutePattern(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) configError('Custom collection route must be a non-empty string')
  const route = value.trim().replace(/^\/+|\/+$/g, '')
  const tokenCount = route.match(/\{slug\}/g)?.length ?? 0
  if (tokenCount !== 1) configError('Custom collection route must contain exactly one {slug} token')
  const parts = route.split('/')
  for (const part of parts) {
    if (part === '{slug}') continue
    if (!/^[a-z0-9][a-z0-9-]*$/.test(part)) {
      configError('Custom collection route segments must be lowercase URL-safe literals or {slug}', 'Use a route like work/{slug} or locations/{slug}.')
    }
  }
  return route
}

function normalizeRequired(value: unknown) {
  if (value == null) return ['title']
  if (!Array.isArray(value)) configError('Custom collection required must be an array of front-matter keys')
  const required = value.map((item) => {
    if (typeof item !== 'string' || !item.trim()) configError('Custom collection required keys must be non-empty strings')
    return item.trim()
  })
  return required.length ? required : ['title']
}

function normalizeFields(value: unknown): ContentFieldConfig[] | undefined {
  if (value == null) return undefined
  if (!Array.isArray(value)) configError('Custom collection fields must be an array')
  return value.map((field) => {
    if (!field || typeof field !== 'object' || Array.isArray(field)) configError('Custom collection fields must be objects')
    const record = field as Record<string, unknown>
    if (typeof record.name !== 'string' || !record.name.trim()) configError('Custom collection field.name must be a non-empty string')
    return { ...record, name: record.name.trim() } as ContentFieldConfig
  })
}

function validateCustomCollection(raw: unknown): ContentCollectionConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) configError('Custom collection entries must be objects')
  const record = raw as Record<string, unknown>
  const name = typeof record.name === 'string' ? record.name.trim() : ''
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    configError('Custom collection name must be a lowercase id', 'Use [a-z][a-z0-9-]*, e.g. projects or team-members.')
  }
  if (name === 'posts' || name === 'pages') {
    configError(`Custom collection name "${name}" is reserved`, 'Built-in posts stay implicit; authored pages belong in src/pages. Use another collection name.')
  }

  return {
    name,
    label: typeof record.label === 'string' ? record.label : undefined,
    path: normalizeContentPath(record.path),
    template: normalizeTemplate(record.template),
    route: normalizeRoutePattern(record.route),
    required: normalizeRequired(record.required),
    fields: normalizeFields(record.fields),
  }
}

export async function loadCustomContentCollections(projectRoot = root): Promise<ContentCollectionConfig[]> {
  const rel = 'content/collections.json'
  const path = join(projectRoot, rel)
  if (!(await exists(path))) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(path, 'utf8'))
  } catch (err) {
    throw new BuildError('Invalid content/collections.json', {
      file: rel,
      hint: err instanceof Error ? err.message : 'Fix JSON syntax.',
    })
  }

  const collections = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>).collections
      : undefined

  if (!Array.isArray(collections)) {
    configError('content/collections.json must contain a collections array', 'Use { "collections": [{ "name": "projects", ... }] }.')
  }

  const seen = new Set<string>()
  return collections.map((entry) => {
    const collection = validateCustomCollection(entry)
    if (seen.has(collection.name)) configError(`Duplicate custom collection name "${collection.name}"`)
    seen.add(collection.name)
    return collection
  })
}

export async function loadContentCollections(projectRoot = root): Promise<ContentCollectionConfig[]> {
  return [...BUILTIN_COLLECTIONS, ...(await loadCustomContentCollections(projectRoot))]
}

function assertSafeBasename(basename: string, sourceRel: string) {
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(basename)) return
  throw new BuildError(`Unsafe content filename slug "${basename}"`, {
    file: sourceRel,
    hint: 'Use lowercase URL-safe filenames like acme-project.md. Front-matter slug overrides are not supported.',
  })
}

function routeSlugFor(pattern: string, basename: string) {
  return pattern.replace('{slug}', basename).replace(/^\/+|\/+$/g, '')
}

async function compileFile(
  projectRoot: string,
  collection: ContentCollectionConfig,
  filename: string,
  template: string,
): Promise<ContentRoute> {
  const dir = join(projectRoot, collection.path)
  const fullPath = join(dir, filename)
  const sourceRel = `${collection.path}/${filename}`
  const raw = await readFile(fullPath, 'utf8')
  const { data, body } = parseFrontMatter(raw)
  assertNoFrontMatterSlug(data, sourceRel, raw)
  const basename = filename.replace(/\.md$/i, '')
  assertSafeBasename(basename, sourceRel)
  const slug = routeSlugFor(collection.route, basename)

  for (const field of collection.required) {
    const ok = field === 'body' ? body.trim().length > 0 : !!fmString(data, field)
    if (ok) continue
    throw new BuildError(`${sourceRel} missing "${field}" in front-matter`, {
      file: sourceRel,
      line: frontMatterFieldLine(raw, field),
      hint: `Add ${field}: ... to the front matter, or remove it from the collection required fields.`,
    })
  }
  const date = collection.builtin === 'posts' ? assertPostDate(data, sourceRel, raw) : undefined

  assertSafeContentMarkdown(raw, sourceRel)
  assertValidContentMediaRefs(body, sourceRel, raw, markdownBodyStart(raw))
  const normalizedBody = normalizeContentMediaRefs(body)
  const html = renderMarkdown(normalizedBody, { file: sourceRel })
  const frontMatterTags = fmStringArray(data, 'tags')
  const tags = normalizeContentTags(frontMatterTags.length ? frontMatterTags : parseTags(fmString(data, 'tags')))
  const draft = fmString(data, 'draft') === 'true' || fmString(data, 'draft') === '1'
  const flat: Record<string, string> = {}
  const typedData: TemplateContext = {}
  for (const [k, v] of Object.entries(data)) {
    const normalized = normalizeContentTemplateValue(v, sourceRel, raw)
    typedData[k] = normalized
    flat[k] = typeof normalized === 'string' ? normalized : normalized == null ? '' : JSON.stringify(normalized)
  }
  const vars: TemplateContext = {
    ...typedData,
    title: fmString(data, 'title'),
    slug,
    basename,
    collection: collection.name,
    body: safeHtml(html),
    tagsHtml: safeHtml(tags.map((t) => `<Tag href="/tags/${slugifyTag(t)}/" label="${escapeHtml(t)}" />`).join(' ')),
  }
  let composed = renderTemplate(template, vars, {
    allowEach: true,
    placeholders: true,
    preserveUnknownPlaceholders: true,
    file: sourceRel,
  })
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
    date,
    collection: collection.name,
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

export async function compileContentFrom(options: {
  rootDir?: string
  srcDir?: string
  includeDrafts?: boolean
} = {}): Promise<ContentRoute[]> {
  const projectRoot = options.rootDir ?? root
  const sourceRoot = options.srcDir ?? join(projectRoot, 'src')
  const includeDrafts = options.includeDrafts ?? !!process.env.SNZ_DEV
  const out: ContentRoute[] = []
  const seenSlugs = new Map<string, string>()
  const legacyPages = await markdownFiles(join(projectRoot, 'content', 'pages'))
  if (legacyPages.length) {
    throw new BuildError('Generic CMS pages are not supported', {
      file: `content/pages/${legacyPages[0]}`,
      hint: 'Move authored pages to src/pages, or create a named custom collection with `bun run new collection <name>`.',
    })
  }

  for (const collection of await loadContentCollections(projectRoot)) {
    const dir = join(projectRoot, collection.path)
    if (!(await exists(dir))) continue
    const files = await markdownFiles(dir)
    if (files.length === 0) continue
    const template = await loadTemplate(sourceRoot, collection.template)
    for (const f of files) {
      const route = await compileFile(projectRoot, collection, f, template)
      if (route.draft && !includeDrafts) continue
      const existing = seenSlugs.get(route.slug)
      if (existing) {
        throw new BuildError(`Duplicate content route slug "/${route.slug}/"`, {
          file: route.source,
          hint: `Already generated by ${existing}. Rename one markdown file or change the custom collection route.`,
        })
      }
      seenSlugs.set(route.slug, route.source)
      out.push(route)
    }
  }
  return out
}

export async function compileContent(): Promise<ContentRoute[]> {
  return compileContentFrom({ rootDir: root, srcDir: src })
}
