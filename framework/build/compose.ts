import { buildErrorAt, BuildError, lineOf } from './errors'
import { resolveImageAttrs, type ImageMeta } from './images'
import { rejectStyleInRoute } from './extract-css'
import { absoluteUrl, buildSchemaGraph, type SiteConfig } from './seo'
import { loadSiteConfig as readSiteConfig } from './site-config'
import { buildYear } from './source-files'
import { publicMarkdownPathFromSlug, routeJsonPathFromSlug, slugFromPath } from '../runtime/lib/paths.js'
import { nextComponent, parseAttrs, type ComponentMatch } from './tags'
import { decodeEntities, escapeHtml } from './html'
import { html as safeHtml, renderPlaceholders, renderTemplate, type TemplateContext } from './template-directives'
import { ensureHeadingIds } from './heading-ids'

const HEAD_WRAPPER_RE = /^<head[^>]*>([\s\S]*?)<\/head>\s*/i
const SLOT_NAMED_RE = /\{\{slot:([\w-]+)\}\}/g
const NAMED_SLOT_TAG_RE = /<slot\s+name=["']([\w-]+)["']\s*>([\s\S]*?)<\/slot>/gi
const SEO_RE = /<SEO((?:\s+(?:[\w-]+(?:="[^"]*")?))*)\s*\/>/i
const SEO_ATTRS = new Set(['title', 'description', 'image', 'ogImage', 'path', 'unlisted'])

export type SchemaAttr = {
  required?: boolean
  enum?: string[]
  description?: string
  /** When true, the attribute's value is appended as a class on the template's root element. */
  asClass?: boolean
}

export type ComponentSchema = {
  description?: string
  attrs?: Record<string, SchemaAttr>
  /** Optional structured-data emitter — see build/discovery.ts. */
  schema?: { type: string; map?: Record<string, string> }
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

  function escapeAttr(value: string) {
    return escapeHtml(value)
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

  /** Attribute values are HTML attribute text: entities decode here and every placeholder escapes on render. */
  function decodeAttrs(attrs: Record<string, string>) {
    return Object.fromEntries(Object.entries(attrs).map(([key, value]) => [key, decodeEntities(value)]))
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
    const schema = buildSchemaGraph(site, {
      title,
      description,
      canonical,
      slug: slugFromPath(path),
    })

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

  async function enrichComponentAttrs(name: string, attrs: Record<string, string>): Promise<TemplateContext> {
    if (name === 'Image') {
      const resolved = resolveImageAttrs(getImageMeta(), attrs)
      return { ...resolved, imgMain: safeHtml(resolved.imgMain) }
    }

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
    for (const key of Object.keys(attrs)) {
      if (declared[key] !== undefined) continue
      if (key === 'track') continue
      throw buildErrorAt(`<${name} /> has unknown attribute "${key}"`, source, index, {
        file: fileHint,
        hint: `Declared attrs: ${Object.keys(declared).join(', ') || '(none)'} — add it to the inline schema comment if intended.`,
      })
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

  /** One pass: blocks, attrs, and slots render together. Slots are raw HTML; interpolated values are never rescanned. */
  function renderTemplateOnce(name: string, template: string, attrs: TemplateContext, slots: ReturnType<typeof readSlots>) {
    const componentData = dataByComponent.get(name)
    const context: TemplateContext = {
      ...(componentData ?? {}),
      ...attrs,
      slot: safeHtml(slots.defaultChildren),
      ...Object.fromEntries([...templateSlotNames(template)].map((slot) => [`slot:${slot}`, safeHtml(slots.named[slot] ?? '')])),
    }
    return renderTemplate(template, context, {
      allowEach: !!componentData,
      placeholders: true,
      preserveUnknownPlaceholders: true,
    })
  }

  function componentFileHint(name: string) {
    return `src/components/${name}.html`
  }

  async function expandOne(m: ComponentMatch, fileHint: string, source: string): Promise<string> {
    const rawAttrs = decodeAttrs(m.attrs)
    let attrs: TemplateContext
    try {
      validateAttrs(m.name, rawAttrs, fileHint, source, m.index)
      attrs = await enrichComponentAttrs(m.name, rawAttrs)
    } catch (err) {
      if (err instanceof BuildError && err.line) throw err
      throw buildErrorAt(err instanceof Error ? err.message : String(err), source, m.index, {
        file: err instanceof BuildError ? err.file ?? fileHint : fileHint,
        hint: err instanceof BuildError ? err.hint : 'Check the component attributes and referenced source files.',
      })
    }
    if (onInstance) onInstance({ name: m.name, attrs: rawAttrs, route: currentRoute })

    const template = loadComponent(m.name, fileHint, source, m.index)
    const slots = readSlots(m.children, template)
    const frame = { file: fileHint, line: lineOf(source, m.index), label: `<${m.name} />` }
    let fragment: string
    try {
      fragment = pruneOptionalPlaceholders(renderTemplateOnce(m.name, template, attrs, slots))
    } catch (err) {
      if (!(err instanceof BuildError)) throw err
      err.file ??= componentFileHint(m.name)
      throw err.addFrame(frame)
    }
    fragment = augmentRoot(m.name, fragment, rawAttrs)
    try {
      return await compose(fragment, componentFileHint(m.name))
    } catch (err) {
      if (err instanceof BuildError) throw err.addFrame(frame)
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
    const seoAttrs = seoMatch ? decodeAttrs(parseAttrs(seoMatch[1] ?? '')) : {}
    const extraHead = seoMatch ? match[1].replace(seoMatch[0], '').trim() : match[1].trim()
    const body = html.slice(match[0].length).trim()
    return { seoAttrs, extraHead, body }
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

  function twitterSiteMeta(handle: string) {
    const value = handle.trim()
    if (!value || /^https?:\/\//i.test(value)) return ''
    const site = value.startsWith('@') ? value : `@${value}`
    return `\n<meta name="twitter:site" content="${escapeAttr(site)}">`
  }

  async function expandSeoMarkup(attrs: Record<string, string>, unlisted = false) {
    const seo = await enrichSeoAttrs(attrs)
    const schemaJson = seo.schemaJson.replace(/</g, '\\u003c')
    const robots = unlisted ? '\n<meta name="robots" content="noindex,nofollow">' : ''
    const slug = slugFromPath(attrs.path ?? '/')
    const representations = unlisted ? '' : `
<link rel="alternate" type="text/markdown" href="${escapeAttr(publicMarkdownPathFromSlug(slug))}">
<link rel="describedby" type="application/json" href="${escapeAttr(routeJsonPathFromSlug(slug))}">
<link rel="describedby" href="/llms.txt">`
    return `<title>${escapeAttr(seo.title)}</title>
<meta name="description" content="${escapeAttr(seo.description)}">${robots}
<link rel="canonical" href="${escapeAttr(seo.canonical)}">${representations}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escapeAttr(seo.siteName)}">
<meta property="og:title" content="${escapeAttr(seo.title)}">
<meta property="og:description" content="${escapeAttr(seo.description)}">
<meta property="og:url" content="${escapeAttr(seo.canonical)}">
<meta property="og:image" content="${escapeAttr(seo.image)}">
<meta property="og:locale" content="${escapeAttr(seo.locale)}">${twitterSiteMeta(seo.twitter)}
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
      rejectStyleInRoute(routedRaw, fileHint)

      const { seoAttrs, extraHead: seoHead, body } = stripHeadWrapper(routedRaw.trim(), fileHint)
      const inlineSeo = body.search(/<SEO\b/i)
      if (inlineSeo !== -1) {
        throw buildErrorAt('<SEO /> is only accepted inside the route <head>', routedRaw, routedRaw.lastIndexOf(body) + inlineSeo, {
          file: fileHint,
          hint: 'Keep exactly one self-closing <SEO ... /> inside the route <head>.',
        })
      }
      const seoOverrides = { ...seoAttrs }
      validateSeoAttrs(seoOverrides, fileHint)
      const unlisted = seoBooleanAttr(seoOverrides, 'unlisted', fileHint)
      delete seoOverrides.unlisted

      const seoMarkup = await expandSeoMarkup(await mergeSeoAttrs(slug, seoOverrides, fileHint), unlisted || slug === '404')
      const composedBody = ensureHeadingIds(await compose(body, fileHint), fileHint)
      const headExtras = [seoHead, ...headLinks].filter(Boolean)
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
      currentYear: buildYear(),
      locale: site.locale ?? 'en',
      scroll,
    }
    let substituted = renderPlaceholders(raw, shellVars, { placeholders: true, preserveUnknownPlaceholders: true })
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


