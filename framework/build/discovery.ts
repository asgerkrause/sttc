// Agent-readable discovery projections, driven by RouteRecord after each route is composed.

import { mkdir, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { absoluteUrl, buildSchemaGraph, isPublicRoute, matchAuthor, personId, type JsonLdNode, type SiteConfig } from './seo'
import {
  publicMarkdownPathFromSlug,
  publicPathFromSlug,
  routeJsonPathFromSlug,
  routeMarkdownPathFromSlug,
} from '../runtime/lib/paths.js'
import type { ComponentSchema, ComposeInstance } from './compose'
import { isoDate, type ContentRoute } from './content'
import { extractHtmlMetadata } from './html'
import { GENERATOR_NAME, GENERATOR_VERSION } from './version'
import { mapConcurrent } from './concurrency'
import { htmlToMarkdown } from './markdown-output'
import { BuildError } from './errors'

export type RouteRecord = {
  slug: string
  title: string
  description: string
  components: ComposeInstance[]
  internalLinks: string[]
  schemas: string[]
  /** Built and directly reachable, but omitted from public discovery. */
  unlisted?: boolean
  /** Composed route HTML used to derive the public Markdown representation. */
  renderedHtml?: string
  /** Content front-matter dateModified ?? date as ISO; authored routes have none. */
  lastModified?: string
}

export const MANIFEST_SCHEMA_VERSION = 2

export const extractRouteMetadata = extractHtmlMetadata

export type RouteSchemaExtras = {
  schemas: string[]
  extraJsonLd: JsonLdNode[]
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function componentSchemaExtras(record: RouteRecord, schemas: Map<string, ComponentSchema>): RouteSchemaExtras {
  const extraJsonLd: JsonLdNode[] = []
  const schemaTypes: string[] = []

  for (const inst of record.components) {
    const decl = schemas.get(inst.name)?.schema
    if (!decl) continue
    const node: JsonLdNode = { '@type': decl.type }
    for (const [outKey, inKey] of Object.entries(decl.map ?? {})) {
      if (inst.attrs[inKey]) node[outKey] = inst.attrs[inKey]
    }
    schemaTypes.push(decl.type)
    extraJsonLd.push(node)
  }

  return { schemas: uniqueStrings([...record.schemas, ...schemaTypes]), extraJsonLd }
}

function contentDateModified(content: ContentRoute) {
  return isoDate(content.data.dateModified)
    ?? isoDate(content.data.modified)
    ?? isoDate(content.data.updated)
}

function blogPostingFor(record: RouteRecord, content: ContentRoute, site: SiteConfig): JsonLdNode {
  const canonical = absoluteUrl(site.url, publicPathFromSlug(record.slug))
  const node: JsonLdNode = {
    '@type': 'BlogPosting',
    '@id': `${canonical}#article`,
    headline: record.title,
    description: record.description,
    datePublished: content.date ?? content.data.date,
    dateModified: contentDateModified(content),
    mainEntityOfPage: { '@id': `${canonical}#webpage` },
    publisher: { '@id': absoluteUrl(site.url, '/#organization') },
    url: canonical,
  }
  const authorName = content.data.author?.trim()
  if (!authorName) return node
  const matched = matchAuthor(site, authorName)
  node.author = matched
    ? { '@id': personId(site, matched) }
    : { '@type': 'Person', name: authorName }
  return node
}

export function routeSchemaExtras(
  record: RouteRecord,
  schemas: Map<string, ComponentSchema>,
  content: ContentRoute | undefined,
  site: SiteConfig,
): RouteSchemaExtras {
  const componentExtras = componentSchemaExtras(record, schemas)
  const schemaTypes = [...componentExtras.schemas]
  const extraJsonLd = [...componentExtras.extraJsonLd]

  if (content?.collection === 'posts') {
    schemaTypes.push('BlogPosting')
    extraJsonLd.push(blogPostingFor(record, content, site))
  }
  return { schemas: uniqueStrings(schemaTypes), extraJsonLd }
}

export type DiscoveryInput = {
  site: SiteConfig
  routes: RouteRecord[]
  componentSchemas: Map<string, ComponentSchema>
  componentUseCounts: Map<string, number>
  contentByslug: Map<string, ContentRoute>
  routeExtrasBySlug?: Map<string, RouteSchemaExtras>
}

function publicContact(contact: SiteConfig['contact']) {
  if (!contact) return undefined
  return { email: contact.email, telephone: contact.telephone, url: contact.url }
}

function publicAddress(address: SiteConfig['address']) {
  if (!address) return undefined
  return {
    streetAddress: address.streetAddress,
    addressLocality: address.addressLocality,
    addressRegion: address.addressRegion,
    postalCode: address.postalCode,
    addressCountry: address.addressCountry,
  }
}

function publicSite(site: SiteConfig) {
  const organization = site.organization ? {
    name: site.organization.name,
    legalName: site.organization.legalName,
    logo: site.organization.logo,
    sameAs: site.organization.sameAs,
    contact: publicContact(site.organization.contact),
    address: publicAddress(site.organization.address),
  } : undefined
  const product = site.product ? {
    type: site.product.type,
    name: site.product.name,
    description: site.product.description,
    path: site.product.path,
    category: site.product.category,
    image: site.product.image,
    sku: site.product.sku,
    audience: site.product.audience,
    offers: site.product.offers ? {
      price: site.product.offers.price,
      priceCurrency: site.product.offers.priceCurrency,
      availability: site.product.offers.availability,
      url: site.product.offers.url,
    } : undefined,
  } : undefined
  return {
    name: site.name,
    url: site.url,
    description: site.description,
    locale: site.locale,
    image: site.image ?? site.ogImage,
    organization,
    brand: site.brand ? { name: site.brand.name, slogan: site.brand.slogan, logo: site.brand.logo } : undefined,
    product,
    sameAs: site.sameAs,
    contact: publicContact(site.contact),
    address: publicAddress(site.address),
    topics: site.topics,
  }
}

function routeRepresentation(site: SiteConfig, slug: string) {
  const path = publicPathFromSlug(slug)
  const canonical = absoluteUrl(site.url, path)
  return {
    id: `${canonical}#webpage`,
    path,
    canonical,
    representations: {
      html: `/routes/${slug}.html`,
      markdown: publicMarkdownPathFromSlug(slug),
      metadata: routeJsonPathFromSlug(slug),
    },
  }
}

function distFromPublicPath(distDir: string, publicPath: string) {
  return join(distDir, publicPath.slice(1))
}

function selectFeaturedRoutes<T extends { slug: string }>(featured: string[], routes: T[]): T[] {
  const bySlug = new Map(routes.map((route) => [route.slug, route]))
  const selected: T[] = []
  const seen = new Set<string>()
  for (const slug of featured) {
    const route = bySlug.get(slug)
    if (!route) {
      throw new BuildError(`Unknown featured discovery slug "${slug}"`, {
        file: 'src/site.json',
        hint: 'Use a public route slug.',
      })
    }
    if (seen.has(slug)) continue
    seen.add(slug)
    selected.push(route)
  }
  return selected
}

function featuredRoutes<T extends { slug: string }>(site: SiteConfig, routes: T[]): T[] | undefined {
  const featured = site.discovery?.featured
  if (!Array.isArray(featured) || !featured.length) return undefined
  return selectFeaturedRoutes(featured, routes)
}

function discoveryNoteLines(notes: string | undefined): string[] {
  if (!notes?.trim()) return []
  const paragraphs = notes.trim().split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)
  return paragraphs.flatMap((paragraph) => [paragraph, ''])
}

function llmsRouteLink(site: SiteConfig, route: { slug: string; title: string; description: string }) {
  return `- [${route.title}](${absoluteUrl(site.url, publicMarkdownPathFromSlug(route.slug))}): ${route.description}`
}

export async function writeDiscovery(distDir: string, input: DiscoveryInput) {
  const { site, routes, componentSchemas, contentByslug, routeExtrasBySlug } = input
  await rm(join(distDir, '.well-known', 'ai-plugin.json'), { force: true })
  const enrichedRoutes = routes.map((record) => ({
    ...record,
    ...(routeExtrasBySlug?.get(record.slug) ?? routeSchemaExtras(record, componentSchemas, contentByslug.get(record.slug), site)),
  }))
  const publicRoutes = enrichedRoutes.filter((route) => isPublicRoute(route) && route.slug !== '404')
  const featured = featuredRoutes(site, publicRoutes)
  const markdownBySlug = new Map<string, string>()

  await mapConcurrent(publicRoutes, 4, async (route) => {
    const jsonPath = distFromPublicPath(distDir, routeJsonPathFromSlug(route.slug))
    const markdownPath = distFromPublicPath(distDir, routeMarkdownPathFromSlug(route.slug))
    const publicMarkdownPath = distFromPublicPath(distDir, publicMarkdownPathFromSlug(route.slug))
    await Promise.all([
      mkdir(join(jsonPath, '..'), { recursive: true }),
      mkdir(join(publicMarkdownPath, '..'), { recursive: true }),
    ])
    const representation = routeRepresentation(site, route.slug)
    const markdown = htmlToMarkdown(route.renderedHtml ?? '')
    const markdownFile = `${markdown}\n`
    markdownBySlug.set(route.slug, markdown)
    await Promise.all([
      writeFile(markdownPath, markdownFile),
      writeFile(publicMarkdownPath, markdownFile),
      writeFile(jsonPath, JSON.stringify({
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        generator: { name: GENERATOR_NAME, version: GENERATOR_VERSION },
        ...representation,
        slug: route.slug,
        title: route.title,
        description: route.description,
        lastModified: route.lastModified,
        internalLinks: route.internalLinks,
        schemas: route.schemas,
        extraJsonLd: route.extraJsonLd,
      }, null, 2)),
    ])
  })

  await Promise.all([
    writeLlmsTxt(distDir, site, publicRoutes, contentByslug, markdownBySlug, featured),
    writeManifest(distDir, { ...input, routes: publicRoutes }),
    writeSiteGraph(distDir, site, publicRoutes),
  ])
}

function siteFactLines(site: SiteConfig): string[] {
  const lines: string[] = []
  const sameAs = site.organization?.sameAs ?? site.sameAs ?? []
  const contact = site.organization?.contact ?? site.contact
  const topics = site.topics ?? []
  if (!sameAs.length && !contact && !topics.length) return lines

  lines.push('## Site facts', '')
  if (topics.length) lines.push(`- Topics: ${topics.join(', ')}`)
  if (sameAs.length) lines.push(`- Same-as: ${sameAs.join(', ')}`)
  if (contact?.email) lines.push(`- Contact: ${contact.email}`)
  if (contact?.url) lines.push(`- Contact URL: ${absoluteUrl(site.url, contact.url)}`)
  lines.push('')
  return lines
}

async function writeLlmsTxt(
  distDir: string,
  site: SiteConfig,
  routes: Array<RouteRecord & RouteSchemaExtras>,
  contentByslug: Map<string, ContentRoute>,
  markdownBySlug: Map<string, string>,
  featured: Array<RouteRecord & RouteSchemaExtras> | undefined,
) {
  const lines = [`# ${site.name}`, '', `> ${site.description}`, '', ...discoveryNoteLines(site.discovery?.notes), ...siteFactLines(site)]
  const primary = featured ?? routes
  const pages = primary.filter((route) => contentByslug.get(route.slug)?.collection !== 'posts')
  const posts = primary.filter((route) => contentByslug.get(route.slug)?.collection === 'posts')

  for (const [heading, items] of [['Pages', pages], ['Posts', posts]] as const) {
    if (!items.length) continue
    lines.push(`## ${heading}`, '')
    for (const route of items) lines.push(llmsRouteLink(site, route))
    lines.push('')
  }
  lines.push('## Optional', '')
  if (featured) {
    const featuredSlugs = new Set(featured.map((route) => route.slug))
    for (const route of routes) {
      if (featuredSlugs.has(route.slug)) continue
      lines.push(llmsRouteLink(site, route))
    }
  }
  lines.push(`- [Site manifest](${absoluteUrl(site.url, '/site.manifest.json')}): Machine-readable public route inventory.`)
  lines.push(`- [Entity graph](${absoluteUrl(site.url, '/site.jsonld')}): Connected Schema.org site graph.`)
  lines.push('')
  await writeFile(join(distDir, 'llms.txt'), lines.join('\n'))

  const full = [...lines]
  for (const route of routes) {
    full.push('---', '', `# ${route.title}`, '', `URL: ${absoluteUrl(site.url, publicPathFromSlug(route.slug))}`, '')
    full.push(markdownBySlug.get(route.slug) ?? htmlToMarkdown(route.renderedHtml ?? ''), '')
  }
  await writeFile(join(distDir, 'llms-full.txt'), full.join('\n'))
}

async function writeManifest(distDir: string, input: DiscoveryInput) {
  const { site, routes, componentSchemas } = input
  const publicUseCounts = new Map<string, number>()
  for (const route of routes) {
    for (const instance of route.components) publicUseCounts.set(instance.name, (publicUseCounts.get(instance.name) ?? 0) + 1)
  }
  const manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    generator: { name: GENERATOR_NAME, version: GENERATOR_VERSION },
    site: publicSite(site),
    graph: '/site.jsonld',
    routes: routes.map((route) => ({
      ...routeRepresentation(site, route.slug),
      slug: route.slug,
      title: route.title,
      description: route.description,
      lastModified: route.lastModified,
      internalLinks: route.internalLinks,
      schemas: route.schemas,
    })),
    components: [...publicUseCounts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, uses]) => ({
      name,
      uses,
      schema: componentSchemas.get(name) ?? {},
    })),
  }
  await writeFile(join(distDir, 'site.manifest.json'), JSON.stringify(manifest, null, 2))
}

async function writeSiteGraph(
  distDir: string,
  site: SiteConfig,
  routes: Array<RouteRecord & RouteSchemaExtras>,
) {
  const nodes = new Map<string, JsonLdNode>()
  const titlesBySlug = Object.fromEntries(routes.map((route) => [route.slug, route.title]))
  for (const route of routes) {
    const canonical = absoluteUrl(site.url, publicPathFromSlug(route.slug))
    const graph = buildSchemaGraph(site, {
      title: route.title,
      description: route.description,
      canonical,
      slug: route.slug,
      titlesBySlug,
    }, route.extraJsonLd)
    for (const node of graph['@graph']) {
      const key = typeof node['@id'] === 'string' ? node['@id'] : JSON.stringify(node)
      nodes.set(key, node)
    }
  }
  await writeFile(join(distDir, 'site.jsonld'), JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [...nodes.values()],
  }, null, 2))
}
