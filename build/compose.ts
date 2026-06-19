import { readFile } from 'fs/promises'
import { join } from 'path'
import { buildErrorAt, BuildError } from './errors'
import { resolveImageAttrs, type ImageMeta } from './images'
import { render as renderMarkdown } from './markdown'
import { componentsDir, src } from './paths'
import { rejectStyleInRoute } from './extract-css'
import { absoluteUrl, buildSchemaGraph, type SiteConfig } from './seo'
import { COMPONENT_OPEN_RE, nextComponent, parseAttrs, type ComponentMatch } from './tags'

const LEGACY_COMPONENT_RE = /<component\s+/i
const LEGACY_COMMENT_RE = /<!--\s*@(component|seo)\b/
const HEAD_WRAPPER_RE = /^<head[^>]*>([\s\S]*?)<\/head>\s*/i
const SLOT_DEFAULT_RE = /\{\{slot\}\}/g
const SLOT_NAMED_RE = /\{\{slot:([\w-]+)\}\}/g
const NAMED_SLOT_TAG_RE = /<slot\s+name=["']([\w-]+)["']\s*>([\s\S]*?)<\/slot>/gi

export type SchemaAttr = {
  required?: boolean
  enum?: string[]
  type?: 'string' | 'number' | 'boolean'
  default?: string
  description?: string
  /** When true, the attribute's value is appended as a class on the template's root element. */
  asClass?: boolean
}

export type ComponentSchema = {
  description?: string
  attrs?: Record<string, SchemaAttr>
  slots?: string[]
  allowUnknownAttrs?: boolean
  /** Optional structured-data emitter — see build/discovery.ts. */
  schema?: { type: string; map?: Record<string, string> }
  /** Optional render examples used by the preview sandbox + auto-docs. */
  examples?: { attrs?: Record<string, string>; slot?: string }[]
}

export type ComposeInstance = {
  name: string
  attrs: Record<string, string>
  route?: string
}

export type RouteComposeInput = {
  slug: string
  fileHint: string
}

export type Composer = ReturnType<typeof createComposer>

export function createComposer(
  templates: Map<string, string>,
  schemas: Map<string, ComponentSchema>,
  getImageMeta: () => Record<string, ImageMeta>,
  onInstance?: (inst: ComposeInstance) => void,
  /** Names of components that have a lifecycle <script>. Their root gets data-snz-component. */
  scriptsByComponent?: Set<string>,
) {
  let siteConfig: SiteConfig | null = null
  let currentRoute: string | undefined

  async function loadSiteConfig(): Promise<SiteConfig> {
    if (siteConfig) return siteConfig
    const raw = await readFile(join(src, 'site.json'), 'utf8')
    siteConfig = JSON.parse(raw) as SiteConfig
    return siteConfig
  }

  function resetSiteConfig() {
    siteConfig = null
  }

  function rejectLegacySyntax(html: string, fileHint: string) {
    if (LEGACY_COMMENT_RE.test(html) || LEGACY_COMPONENT_RE.test(html)) {
      throw new BuildError(
        `Legacy syntax in ${fileHint}: use PascalCase components (<Button … />, <SEO … />)`,
        { file: fileHint, hint: 'Replace <component> tags and <!-- @component --> comments with PascalCase tags' },
      )
    }
  }

  function escapeAttr(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  function substitute(template: string, attrs: Record<string, string>) {
    return template
      .replace(/\{\{(\w+)\}\}/g, (_, key) => attrs[key] ?? '')
      .replace(/\s(?:id|data-theme|c|r|o)=""/g, '')
  }

  function titleCase(slug: string) {
    if (slug === '404') return 'Not found'
    const label = slug.split('/').filter(Boolean).at(-1) ?? slug
    return label
      .split(/[-_]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  async function defaultSeoAttrs(slug: string): Promise<Record<string, string>> {
    const site = await loadSiteConfig()
    if (slug === 'index') {
      return { title: site.name, path: '/', description: site.description }
    }
    return {
      title: `${titleCase(slug)} — ${site.name}`,
      path: `/${slug}/`,
      description: site.description,
    }
  }

  async function enrichSeoAttrs(attrs: Record<string, string>) {
    const site = await loadSiteConfig()
    const title = attrs.title ?? site.name
    const description = attrs.description ?? site.description
    const path = attrs.path ?? '/'
    const canonical = absoluteUrl(site.url, path)
    const ogPath = attrs.ogImage ?? site.ogImage ?? ''
    const ogImage = ogPath ? absoluteUrl(site.url, ogPath) : ''
    const schema = buildSchemaGraph(site, { title, description, canonical })

    return {
      title,
      description,
      canonical,
      ogImage,
      locale: site.locale ?? 'en',
      twitter: site.twitter ?? '',
      siteName: site.name,
      schemaJson: JSON.stringify(schema),
    }
  }

  async function enrichComponentAttrs(name: string, attrs: Record<string, string>) {
    if (name === 'SEO') return enrichSeoAttrs(attrs)
    if (name === 'Image') return resolveImageAttrs(getImageMeta(), attrs)

    const site = await loadSiteConfig()
    if ((name === 'Header' || name === 'Footer' || name === 'Logo') && !attrs.siteName) attrs.siteName = site.name
    if (name === 'Logo') {
      attrs.href ??= '/'
      attrs.size ??= '1lh'
    }
    if (name === 'Button') {
      attrs.href ??= '#'
      attrs.label ??= 'Learn more'
    }
    if (name === 'Link') {
      attrs.href ??= '#'
      attrs.label ??= 'Learn more'
    }
    if (name === 'Accordion') {
      attrs.summary ??= 'Details'
      attrs.body ??= ''
    }
    if (name === 'Embed') attrs.ratio ??= '16/9'
    if (name === 'Features') attrs.cols ??= '3-2'
    if (name === 'Partners') attrs.label ??= 'Trusted organizations'
    if (name === 'Pricing') attrs.cols ??= '3-3'
    if (name === 'Plan') attrs.featured ??= 'false'
    if (name === 'Testimonials') attrs.cols ??= '2'
    if (name === 'Stats') attrs.cols ??= '3-3'
    return attrs
  }

  function loadComponent(name: string, fileHint: string, source?: string, index?: number) {
    const tpl = templates.get(name)
    if (tpl !== undefined) return tpl
    // No case-insensitive fallback. Suggest the right cased name if close.
    const candidates = [...templates.keys()].filter((k) => k.toLowerCase() === name.toLowerCase())
    const hint = candidates.length
      ? `Did you mean <${candidates[0]} ... />? (PascalCase required.)`
      : `Create src/components/${name}.html`
    if (source && index !== undefined) {
      throw buildErrorAt(`Unknown component <${name} />`, source, index, { file: fileHint, hint })
    }
    throw new BuildError(`Unknown component <${name} />`, { file: fileHint, hint })
  }

  function validateAttrs(name: string, attrs: Record<string, string>, fileHint: string, source: string, index: number) {
    const schema = schemas.get(name)
    if (!schema) return // no schema = no validation (back-compat)

    const declared = schema.attrs ?? {}
    for (const [key, rule] of Object.entries(declared)) {
      if (rule.required && (attrs[key] === undefined || attrs[key] === '')) {
        throw buildErrorAt(`<${name} /> missing required attribute "${key}"`, source, index, {
          file: fileHint,
          hint: rule.description,
        })
      }
      if (rule.enum && attrs[key] !== undefined && !rule.enum.includes(attrs[key])) {
        throw buildErrorAt(
          `<${name} /> attribute "${key}" must be one of ${rule.enum.join(', ')} — got "${attrs[key]}"`,
          source,
          index,
          { file: fileHint },
        )
      }
    }
    if (!schema.allowUnknownAttrs) {
      for (const key of Object.keys(attrs)) {
        // built-in enrichers may add keys post-validate; allow common ones for SEO/Image
        if (declared[key] !== undefined) continue
        if (key === 'track') continue
        if (name === 'SEO' || name === 'Image' || name === 'Header' || name === 'Footer' || name === 'Logo') continue
        throw buildErrorAt(`<${name} /> has unknown attribute "${key}"`, source, index, {
          file: fileHint,
          hint: `Declared attrs: ${Object.keys(declared).join(', ') || '(none)'} — add it to the inline schema comment if intended.`,
        })
      }
    }
  }

  function expandSlots(template: string, children: string): string {
    if (!children) {
      return template.replace(SLOT_NAMED_RE, '').replace(SLOT_DEFAULT_RE, '')
    }
    // Pull named-slot blocks out of children first.
    const named: Record<string, string> = {}
    const defaultChildren = children.replace(NAMED_SLOT_TAG_RE, (_, n, body) => {
      named[n] = body
      return ''
    }).trim()
    return template
      .replace(SLOT_NAMED_RE, (_, name) => named[name] ?? '')
      .replace(SLOT_DEFAULT_RE, defaultChildren)
  }

  async function expandOne(m: ComponentMatch, fileHint: string, source: string): Promise<string> {
    if (m.name === 'SEO' && m.selfClosing === false) {
      throw new BuildError('<SEO> must be self-closing', { file: fileHint })
    }
    let attrs: Record<string, string>
    try {
      attrs = await enrichComponentAttrs(m.name, { ...m.attrs })
      validateAttrs(m.name, attrs, fileHint, source, m.index)
    } catch (err) {
      if (err instanceof BuildError && err.line) throw err
      throw buildErrorAt(err instanceof Error ? err.message : String(err), source, m.index, {
        file: err instanceof BuildError ? err.file ?? fileHint : fileHint,
        hint: err instanceof BuildError ? err.hint : 'Check the component attributes and referenced source files.',
      })
    }
    if (onInstance) onInstance({ name: m.name, attrs: { ...m.attrs }, route: currentRoute })

    const template = loadComponent(m.name, fileHint, source, m.index)
    let children = m.children
    // Markdown: render children as markdown into the `rendered` attr; default slot stays empty.
    if (m.name === 'Markdown' && children) {
      attrs.rendered = renderMarkdown(children, { file: fileHint })
      children = ''
    }
    let fragment = expandSlots(template, children)
    fragment = substitute(fragment, attrs)
    fragment = augmentRoot(m.name, fragment, m.attrs)
    return compose(fragment, fileHint)
  }

  function augmentRoot(name: string, fragment: string, rawAttrs: Record<string, string>): string {
    const schema = schemas.get(name)
    const asClassAttrs = schema?.attrs
      ? Object.entries(schema.attrs).filter(([, rule]) => rule.asClass).map(([k]) => k)
      : []
    const extraClasses = asClassAttrs
      .map((k) => rawAttrs[k])
      .filter((v) => v && v.length > 0)
    const track = rawAttrs.track?.trim()

    // Built-in components don't get data-snz-component injected (chrome, primitives).
    const hasComponentScript = scriptsByComponent?.has(name) ?? false
    const wantDataAttr = hasComponentScript

    if (extraClasses.length === 0 && !wantDataAttr && !track) return fragment

    // Find the first opening tag and augment class + data-snz-component.
    const tagRe = /^(\s*)<([a-z][\w-]*)((?:\s+[\w-]+(?:="[^"]*")?)*)\s*(\/?>)/i
    const match = fragment.match(tagRe)
    if (!match) return fragment
    const [full, lead, tag, attrStr, close] = match
    let newAttrStr = attrStr

    if (extraClasses.length) {
      const classRe = /(\sclass=")([^"]*)(")/
      if (classRe.test(newAttrStr)) {
        newAttrStr = newAttrStr.replace(classRe, (_, a, existing, c) => {
          const joined = [existing, ...extraClasses].filter(Boolean).join(' ')
          return `${a}${joined}${c}`
        })
      } else {
        newAttrStr += ` class="${extraClasses.join(' ')}"`
      }
    }

    if (wantDataAttr && !/\sdata-snz-component=/.test(newAttrStr)) {
      newAttrStr += ` data-snz-component="${name}"`
    }

    if (track && !/\sdata-snz-track=/.test(newAttrStr)) {
      newAttrStr += ` data-snz-track="${escapeAttr(track)}"`
    }

    return `${lead}<${tag}${newAttrStr}${close}${fragment.slice(full.length)}`
  }

  async function compose(html: string, fileHint: string): Promise<string> {
    let out = html
    let guard = 0
    while (true) {
      if (guard++ > 1024) {
        throw new BuildError('Component expansion exceeded 1024 iterations (cycle?)', { file: fileHint })
      }
      const m = nextComponent(out, 0, fileHint)
      if (!m) return out
      const fragment = await expandOne(m, fileHint, out)
      out = out.slice(0, m.index) + fragment + out.slice(m.index + m.full.length)
    }
  }

  function stripHeadWrapper(html: string) {
    const match = html.match(HEAD_WRAPPER_RE)
    if (!match) return { seoAttrs: {} as Record<string, string>, body: html }
    // SEO inside head must be self-closing only here.
    const seoRe = /<SEO((?:\s+[\w-]+="[^"]*")*)\s*\/?>/i
    const seoMatch = match[1].match(seoRe)
    const seoAttrs = seoMatch ? parseAttrs(seoMatch[1] ?? '') : {}
    const body = html.slice(match[0].length).trim()
    return { seoAttrs, body }
  }

  function extractInlineSeo(html: string) {
    const re = /<SEO((?:\s+[\w-]+="[^"]*")*)\s*\/?>/i
    const m = html.match(re)
    if (!m) return { attrs: {} as Record<string, string>, rest: html }
    const attrs = parseAttrs(m[1] ?? '')
    const rest = html.replace(m[0], '').trim()
    return { attrs, rest }
  }

  async function mergeSeoAttrs(slug: string, overrides: Record<string, string>) {
    const defaults = await defaultSeoAttrs(slug)
    return { ...defaults, ...overrides }
  }

  async function expandSeoMarkup(attrs: Record<string, string>, fileHint: string) {
    const enriched = await enrichSeoAttrs(attrs)
    return substitute(loadComponent('SEO', fileHint), enriched)
  }

  async function prepareRouteSource(raw: string, route: RouteComposeInput) {
    const { slug, fileHint } = route
    currentRoute = slug
    try {
      rejectLegacySyntax(raw, fileHint)
      rejectStyleInRoute(raw, fileHint)

      const stripped = stripHeadWrapper(raw.trim())
      const inline = extractInlineSeo(stripped.body)
      const seoOverrides = { ...stripped.seoAttrs, ...inline.attrs }
      const body = inline.rest

      const seoMarkup = await expandSeoMarkup(await mergeSeoAttrs(slug, seoOverrides), fileHint)
      const composedBody = await compose(body, fileHint)
      return `<head>\n${seoMarkup}\n</head>\n${composedBody}`
    } finally {
      currentRoute = undefined
    }
  }

  async function prepareShellSource(raw: string) {
    const fileHint = 'src/shell.html'
    rejectLegacySyntax(raw, fileHint)
    // Substitute shell-level site config placeholders before component expansion.
    const site = await loadSiteConfig()
    const shellVars: Record<string, string> = {
      scroll: site.scroll ?? 'lenis',
      siteName: site.name,
      locale: site.locale ?? 'en',
    }
    const substituted = raw.replace(/\{\{(\w+)\}\}/g, (m, key) => shellVars[key] ?? m)
    return compose(substituted, fileHint)
  }

  return {
    resetSiteConfig,
    prepareRouteSource,
    prepareShellSource,
  }
}

export { componentsDir }
