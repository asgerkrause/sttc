import { buildErrorAt, BuildError, lineOf } from './errors'
import { resolveImageAttrs, type ImageMeta } from './images'
import { componentsDir } from './paths'
import { rejectStyleInRoute } from './extract-css'
import { absoluteUrl, buildSchemaGraph, type SiteConfig } from './seo'
import { loadSiteConfig as readSiteConfig } from './site-config'
import { buildYear } from './source-files'
import { COMPONENT_OPEN_RE, nextComponent, parseAttrs, type ComponentMatch } from './tags'
import { renderPlaceholders, renderTemplate, type TemplateContext } from './template-directives'

const LEGACY_COMPONENT_RE = /<component\s+/i
const LEGACY_COMMENT_RE = /<!--\s*@(component|seo)\b/
const HEAD_WRAPPER_RE = /^<head[^>]*>([\s\S]*?)<\/head>\s*/i
const SLOT_DEFAULT_RE = /\{\{slot\}\}/g
const SLOT_NAMED_RE = /\{\{slot:([\w-]+)\}\}/g
const NAMED_SLOT_TAG_RE = /<slot\s+name=["']([\w-]+)["']\s*>([\s\S]*?)<\/slot>/gi
const SEO_RE = /<SEO((?:\s+(?:[\w-]+(?:="[^"]*")?))*)\s*\/>/i
const SEO_ATTRS = new Set(['title', 'description', 'image', 'ogImage', 'path', 'unlisted'])

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
  headLinks?: string[]
  data?: TemplateContext
}

export type Composer = ReturnType<typeof createComposer>

export function createComposer(
  templates: Map<string, string>,
  schemas: Map<string, ComponentSchema>,
  getImageMeta: () => Record<string, ImageMeta>,
  onInstance?: (inst: ComposeInstance) => void,
  /** Names of components that have a lifecycle <script>. Their root gets data-snz-component. */
  scriptsByComponent?: Set<string>,
  dataByComponent = new Map<string, TemplateContext>(),
  options: { siteFile?: string } = {},
) {
  let siteConfig: SiteConfig | null = null
  let currentRoute: string | undefined

  async function loadSiteConfig(): Promise<SiteConfig> {
    if (siteConfig) return siteConfig
    siteConfig = await readSiteConfig(options.siteFile ?? 'src/site.json')
    return siteConfig
  }

  function resetSiteConfig() {
    siteConfig = null
  }

  function rejectLegacySyntax(html: string, fileHint: string) {
    if (LEGACY_COMMENT_RE.test(html) || LEGACY_COMPONENT_RE.test(html)) {
      throw new BuildError(
        `Legacy syntax in ${fileHint}: use PascalCase components (<Hero … />) and the <SEO … /> route directive`,
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

  const UNRESOLVED_PLACEHOLDER_RE = /\{\{[\w.-]+(?::[\w.-]+)?\}\}/

  function cleanClassAttr(value: string) {
    return value
      .split(/\s+/)
      .filter((token) => token && !UNRESOLVED_PLACEHOLDER_RE.test(token))
      .join(' ')
  }

  function cleanStyleAttr(value: string) {
    return value
      .split(';')
      .map((decl) => decl.trim())
      .filter((decl) => decl && !UNRESOLVED_PLACEHOLDER_RE.test(decl))
      .join('; ')
  }

  function pruneOptionalPlaceholders(html: string) {
    return html
      .replace(/\sclass="([^"]*)"/g, (_, value: string) => {
        const cleaned = cleanClassAttr(value)
        return cleaned ? ` class="${cleaned}"` : ''
      })
      .replace(/\sstyle="([^"]*)"/g, (_, value: string) => {
        const cleaned = cleanStyleAttr(value)
        return cleaned ? ` style="${cleaned}"` : ''
      })
      .replace(/\s[\w:-]+="\{\{[\w.-]+(?::[\w.-]+)?\}\}"/g, '')
  }

  function substitute(template: string, attrs: Record<string, string>) {
    const rendered = renderPlaceholders(template, attrs, {
      placeholders: true,
      preserveUnknownPlaceholders: true,
      preservePlaceholders: (path) => path === 'slot' || path.startsWith('slot:'),
      escapeStrings: false,
    })
    return pruneOptionalPlaceholders(rendered)
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
    const imagePath = attrs.image ?? attrs.ogImage ?? site.image ?? site.ogImage ?? ''
    const image = imagePath ? absoluteUrl(site.url, imagePath) : ''
    const schema = buildSchemaGraph(site, { title, description, canonical })

    return {
      title,
      description,
      canonical,
      image,
      locale: site.locale ?? 'en',
      twitter: site.twitter ?? '',
      siteName: site.name,
      schemaJson: JSON.stringify(schema),
    }
  }

  async function enrichComponentAttrs(name: string, attrs: Record<string, string>) {
    if (name === 'Image') return resolveImageAttrs(getImageMeta(), attrs)

    const site = await loadSiteConfig()
    return { siteName: site.name, currentYear: buildYear(), ...attrs }
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
      const allowsEmptyAlt = name === 'Image' && key === 'alt' && attrs[key] === ''
      if (rule.required && !allowsEmptyAlt && (attrs[key] === undefined || attrs[key] === '')) {
        throw buildErrorAt(`<${name} /> missing required attribute "${key}"`, source, index, {
          file: fileHint,
          hint: rule.description,
        })
      }
      if (rule.enum && attrs[key] !== undefined && attrs[key] !== '' && !rule.enum.includes(attrs[key])) {
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
        if (declared[key] !== undefined) continue
        if (key === 'track') continue
        throw buildErrorAt(`<${name} /> has unknown attribute "${key}"`, source, index, {
          file: fileHint,
          hint: `Declared attrs: ${Object.keys(declared).join(', ') || '(none)'} — add it to the inline schema comment if intended.`,
        })
      }
    }
  }

  function templateSlotNames(template: string) {
    return new Set([...template.matchAll(SLOT_NAMED_RE)].map((m) => m[1]))
  }

  function readSlots(children: string, template: string) {
    const ownSlots = templateSlotNames(template)
    const named: Record<string, string> = {}
    const defaultChildren = children.replace(NAMED_SLOT_TAG_RE, (full, n, body) => {
      if (!ownSlots.has(n)) return full
      named[n] = body
      return ''
    }).trim()
    return { defaultChildren, named }
  }

  function renderConditionals(name: string, template: string, attrs: Record<string, string>, slots: ReturnType<typeof readSlots>) {
    const componentData = dataByComponent.get(name)
    const context: TemplateContext = {
      ...(componentData ?? {}),
      ...attrs,
      slot: slots.defaultChildren,
      ...Object.fromEntries(Object.entries(slots.named).map(([name, value]) => [`slot:${name}`, value])),
    }
    return renderTemplate(template, context, {
      allowEach: !!componentData,
      placeholders: !!componentData,
      preserveUnknownPlaceholders: true,
      preservePlaceholders: (path) => path === 'slot' || path.startsWith('slot:'),
    })
  }

  function expandSlots(template: string, slots: ReturnType<typeof readSlots>): string {
    return template
      .replace(SLOT_NAMED_RE, (_, name) => slots.named[name] ?? '')
      .replace(SLOT_DEFAULT_RE, slots.defaultChildren)
  }

  function componentFileHint(name: string) {
    return `src/components/${name}.html`
  }

  async function expandOne(m: ComponentMatch, fileHint: string, source: string): Promise<string> {
    if (m.name === 'SEO' && m.selfClosing === false) {
      throw new BuildError('<SEO> must be self-closing', { file: fileHint })
    }
    let attrs: Record<string, string>
    try {
      attrs = { ...m.attrs }
      validateAttrs(m.name, attrs, fileHint, source, m.index)
      attrs = await enrichComponentAttrs(m.name, attrs)
    } catch (err) {
      if (err instanceof BuildError && err.line) throw err
      throw buildErrorAt(err instanceof Error ? err.message : String(err), source, m.index, {
        file: err instanceof BuildError ? err.file ?? fileHint : fileHint,
        hint: err instanceof BuildError ? err.hint : 'Check the component attributes and referenced source files.',
      })
    }
    if (onInstance) onInstance({ name: m.name, attrs: { ...m.attrs }, route: currentRoute })

    const template = loadComponent(m.name, fileHint, source, m.index)
    const slots = readSlots(m.children, template)
    let fragment = renderConditionals(m.name, template, attrs, slots)
    fragment = expandSlots(fragment, slots)
    fragment = substitute(fragment, attrs)
    fragment = augmentRoot(m.name, fragment, m.attrs)
    try {
      return await compose(fragment, componentFileHint(m.name))
    } catch (err) {
      if (err instanceof BuildError) {
        throw err.addFrame({ file: fileHint, line: lineOf(source, m.index), label: `<${m.name} />` })
      }
      throw err
    }
  }

  function augmentRoot(name: string, fragment: string, rawAttrs: Record<string, string>): string {
    const schema = schemas.get(name)
    const asClassAttrs = schema?.attrs
      ? Object.entries(schema.attrs).filter(([, rule]) => rule.asClass).map(([k]) => k)
      : []
    const extraClasses = asClassAttrs
      .flatMap((k) => (rawAttrs[k] ?? '').trim().split(/\s+/).filter(Boolean))
    for (const cls of extraClasses) {
      if (!/^[A-Za-z_][\w-]*$/.test(cls)) {
        throw new BuildError(`Invalid class token "${cls}" from <${name} /> attribute`, {
          hint: 'Class-backed attrs may contain space-separated class tokens only.',
        })
      }
    }
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
    let cursor = 0
    let guard = 0
    while (true) {
      if (guard++ > 1024) {
        throw new BuildError('Component expansion exceeded 1024 iterations (cycle?)', { file: fileHint })
      }
      const m = nextComponent(out, cursor, fileHint)
      if (!m) return out
      const fragment = await expandOne(m, fileHint, out)
      out = out.slice(0, m.index) + fragment + out.slice(m.index + m.full.length)
      // expandOne recursively resolves components introduced by this fragment, so resume after it
      // instead of rescanning the already-rendered prefix for every sibling component.
      cursor = m.index + fragment.length
    }
  }

  function stripHeadWrapper(html: string, fileHint: string) {
    const match = html.match(HEAD_WRAPPER_RE)
    if (!match) return { seoAttrs: {} as Record<string, string>, extraHead: '', body: html }
    const seoMatch = match[1].match(SEO_RE)
    if (!seoMatch && /<SEO\b/i.test(match[1])) {
      throw new BuildError('<SEO> must be self-closing', { file: fileHint, hint: 'Use <SEO ... /> inside <head>.' })
    }
    const seoAttrs = seoMatch ? parseAttrs(seoMatch[1] ?? '') : {}
    const extraHead = seoMatch ? match[1].replace(seoMatch[0], '').trim() : match[1].trim()
    const body = html.slice(match[0].length).trim()
    return { seoAttrs, extraHead, body }
  }

  function extractInlineSeo(html: string, fileHint: string) {
    const m = html.match(SEO_RE)
    if (!m) {
      if (/<SEO\b/i.test(html)) {
        throw new BuildError('<SEO> must be self-closing', { file: fileHint, hint: 'Use <SEO ... />.' })
      }
      return { attrs: {} as Record<string, string>, rest: html }
    }
    const attrs = parseAttrs(m[1] ?? '')
    const rest = html.replace(m[0], '').trim()
    return { attrs, rest }
  }

  function validateSeoAttrs(attrs: Record<string, string>, fileHint: string) {
    for (const name of Object.keys(attrs)) {
      if (SEO_ATTRS.has(name)) continue
      throw new BuildError(`<SEO /> has unknown attribute "${name}"`, {
        file: fileHint,
        hint: `Supported attrs: ${[...SEO_ATTRS].join(', ')}.`,
      })
    }
  }

  function seoBooleanAttr(attrs: Record<string, string>, name: string, fileHint: string) {
    const value = attrs[name]
    if (value === undefined || value === 'false') return false
    if (value === '1' || value === 'true') return true
    throw new BuildError(`<SEO /> attribute "${name}" must be bare, "true", or "false"`, {
      file: fileHint,
      hint: `Use ${name}, ${name}="true", or remove the attribute.`,
    })
  }

  async function mergeSeoAttrs(slug: string, overrides: Record<string, string>, fileHint: string) {
    const defaults = await defaultSeoAttrs(slug)
    if (overrides.path && overrides.path !== defaults.path) {
      throw new BuildError('<SEO /> path does not match its route', {
        file: fileHint,
        hint: `Remove path, or use path="${defaults.path}". Canonical URLs are derived from the route filename.`,
      })
    }
    return { ...defaults, ...overrides }
  }

  async function expandSeoMarkup(attrs: Record<string, string>, unlisted = false) {
    const seo = await enrichSeoAttrs(attrs)
    const schemaJson = seo.schemaJson.replace(/</g, '\\u003c')
    const robots = unlisted ? '\n<meta name="robots" content="noindex,nofollow">' : ''
    const representations = unlisted ? '' : `
<link rel="alternate" type="text/markdown" href="${escapeAttr(attrs.path === '/' ? '/routes/index.md' : `/routes${attrs.path.replace(/\/$/, '')}.md`)}">
<link rel="describedby" type="application/json" href="${escapeAttr(attrs.path === '/' ? '/routes/index.json' : `/routes${attrs.path.replace(/\/$/, '')}.json`)}">`
    return `<title>${escapeAttr(seo.title)}</title>
<meta name="description" content="${escapeAttr(seo.description)}">${robots}
<link rel="canonical" href="${escapeAttr(seo.canonical)}">${representations}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escapeAttr(seo.siteName)}">
<meta property="og:title" content="${escapeAttr(seo.title)}">
<meta property="og:description" content="${escapeAttr(seo.description)}">
<meta property="og:url" content="${escapeAttr(seo.canonical)}">
<meta property="og:image" content="${escapeAttr(seo.image)}">
<meta property="og:locale" content="${escapeAttr(seo.locale)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeAttr(seo.title)}">
<meta name="twitter:description" content="${escapeAttr(seo.description)}">
<meta name="twitter:image" content="${escapeAttr(seo.image)}">
<script type="application/ld+json">${schemaJson}</script>`
  }

  async function prepareRoute(raw: string, route: RouteComposeInput) {
    const { slug, fileHint, headLinks = [], data = {} } = route
    currentRoute = slug
    try {
      const routedRaw = Object.keys(data).length
        ? renderTemplate(raw, data, {
            allowEach: true,
            placeholders: true,
            preserveUnknownPlaceholders: true,
            file: fileHint,
          })
        : raw
      rejectLegacySyntax(routedRaw, fileHint)
      rejectStyleInRoute(routedRaw, fileHint)

      const stripped = stripHeadWrapper(routedRaw.trim(), fileHint)
      const inline = extractInlineSeo(stripped.body, fileHint)
      if (Object.keys(stripped.seoAttrs).length && Object.keys(inline.attrs).length) {
        throw new BuildError('Route contains more than one <SEO /> directive', {
          file: fileHint,
          hint: 'Keep exactly one self-closing <SEO ... /> inside the route <head>.',
        })
      }
      const seoOverrides = { ...stripped.seoAttrs, ...inline.attrs }
      validateSeoAttrs(seoOverrides, fileHint)
      const unlisted = seoBooleanAttr(seoOverrides, 'unlisted', fileHint)
      delete seoOverrides.unlisted
      const body = inline.rest

      const seoMarkup = await expandSeoMarkup(await mergeSeoAttrs(slug, seoOverrides, fileHint), unlisted || slug === '404')
      const composedBody = await compose(body, fileHint)
      const headExtras = [stripped.extraHead, ...headLinks].filter(Boolean)
      const extraHead = headExtras.length ? `\n${headExtras.join('\n')}` : ''
      return { html: `<head>\n${seoMarkup}${extraHead}\n</head>\n${composedBody}`, unlisted }
    } finally {
      currentRoute = undefined
    }
  }

  async function prepareRouteSource(raw: string, route: RouteComposeInput) {
    return (await prepareRoute(raw, route)).html
  }

  async function prepareShellSource(raw: string) {
    const fileHint = 'src/shell.html'
    rejectLegacySyntax(raw, fileHint)
    if (/<SEO\b/i.test(raw)) {
      throw new BuildError('<SEO /> is route-only and cannot appear in src/shell.html', {
        file: fileHint,
        hint: 'Put one <SEO ... /> directive in each route <head>.',
      })
    }
    // Substitute shell-level site config placeholders before component expansion.
    const site = await loadSiteConfig()
    const scroll = site.scroll ?? 'lenis'
    const shellVars: Record<string, string> = {
      siteName: site.name,
      currentYear: String(new Date().getFullYear()),
      locale: site.locale ?? 'en',
      scroll,
    }
    let substituted = raw.replace(/\{\{(\w+)\}\}/g, (m, key) => shellVars[key] ?? m)
    if (scroll === 'native') {
      substituted = substituted
        .replace(/\s+data-scroll=(['"])[^'"]*\1/i, '')
        .replace(/\n?[ \t]*<script\b[^>]*\bsrc=(['"])\/assets\/js\/scroll\.js\1[^>]*><\/script>[ \t]*/i, '')
    }
    return compose(substituted, fileHint)
  }

  return {
    resetSiteConfig,
    prepareRoute,
    prepareRouteSource,
    prepareShellSource,
  }
}

export { componentsDir }
