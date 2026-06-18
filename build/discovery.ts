// AI-native discovery layer.
// Emits: /llms.txt, /llms-full.txt, /.well-known/ai-plugin.json,
//        /routes/{slug}.json (per route), /site.manifest.json (everything).
//
// Driven by RouteRecord — populated during the main build as each route is composed.

import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { absoluteUrl, type SiteConfig } from './seo'
import { publicPathFromSlug } from '../runtime/lib/paths.js'
import type { ComponentSchema, ComposeInstance } from './compose'
import type { ContentRoute } from './content'
import { extractHtmlDescription, extractHtmlTitle, scanHtmlInternalLinks } from './html'
import { GENERATOR_NAME, GENERATOR_VERSION } from './version'

export type RouteRecord = {
  slug: string
  title: string
  description: string
  components: ComposeInstance[]
  internalLinks: string[]
  schemas: string[]
  /** Optional markdown body for content routes (used by llms-full.txt). */
  markdown?: string
  /** Date / lastModified ISO string. */
  lastModified?: string
}

export const MANIFEST_SCHEMA_VERSION = 1

export const scanInternalLinks = scanHtmlInternalLinks
export const extractTitle = extractHtmlTitle
export const extractDescription = extractHtmlDescription

/** Build per-route JSON-LD additions based on what components the route contains. */
export function detectSchemas(record: RouteRecord, schemas: Map<string, ComponentSchema>): unknown[] {
  const out: unknown[] = []
  const faqQuestions: { name: string; acceptedAnswer: { text: string } }[] = []
  const howToSteps: { name: string; text: string }[] = []

  for (const inst of record.components) {
    if (inst.name === 'Accordion' || inst.name === 'FAQ') {
      // Treat any Accordion as a FAQ entry (summary = question, body = answer).
      if (inst.attrs.summary && inst.attrs.body) {
        faqQuestions.push({
          name: stripTags(inst.attrs.summary),
          acceptedAnswer: { text: stripTags(inst.attrs.body) },
        })
      }
    }
    if (inst.name === 'Answer' && inst.attrs.question && inst.attrs.short) {
      faqQuestions.push({
        name: inst.attrs.question,
        acceptedAnswer: { text: inst.attrs.short },
      })
    }
    if (inst.name === 'HowTo' && inst.attrs.step) {
      howToSteps.push({ name: inst.attrs.step, text: inst.attrs.text ?? inst.attrs.step })
    }
    // schema mapping declared in ComponentSchema.schema (future hook)
    const decl = schemas.get(inst.name)?.schema
    if (decl) {
      const node: Record<string, unknown> = { '@type': decl.type }
      for (const [out_key, in_key] of Object.entries(decl.map ?? {})) {
        if (inst.attrs[in_key]) node[out_key] = inst.attrs[in_key]
      }
      out.push(node)
    }
  }

  if (faqQuestions.length) {
    record.schemas.push('FAQPage')
    out.push({
      '@type': 'FAQPage',
      mainEntity: faqQuestions.map((q) => ({ '@type': 'Question', name: q.name, acceptedAnswer: { '@type': 'Answer', text: q.acceptedAnswer.text } })),
    })
  }
  if (howToSteps.length) {
    record.schemas.push('HowTo')
    out.push({
      '@type': 'HowTo',
      step: howToSteps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text })),
    })
  }
  return out
}

function stripTags(s: string) {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function blogPostingFor(record: RouteRecord, content: ContentRoute, site: SiteConfig) {
  return {
    '@type': 'BlogPosting',
    headline: record.title,
    description: record.description,
    datePublished: content.data.date ?? record.lastModified,
    author: { '@type': 'Organization', name: site.name },
    url: absoluteUrl(site.url, publicPathFromSlug(record.slug)),
  }
}

export type DiscoveryInput = {
  site: SiteConfig
  routes: RouteRecord[]
  componentSchemas: Map<string, ComponentSchema>
  componentUseCounts: Map<string, number>
  contentByslug: Map<string, ContentRoute>
}

export async function writeDiscovery(distDir: string, input: DiscoveryInput) {
  const { site, routes, componentSchemas, contentByslug } = input

  // Augment each route's JSON-LD with detected schemas and write per-route json.
  for (const r of routes) {
    const extras = detectSchemas(r, componentSchemas)
    const content = contentByslug.get(r.slug)
    if (content?.collection === 'posts') extras.push(blogPostingFor(r, content, site))
    if (r.slug.startsWith('insights/') && !content) r.schemas.push('WebPage')

    const routeJsonPath = join(distDir, 'routes', `${r.slug}.json`)
    await mkdir(join(routeJsonPath, '..'), { recursive: true })
    await writeFile(routeJsonPath, JSON.stringify({
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      generator: {
        name: GENERATOR_NAME,
        version: GENERATOR_VERSION,
      },
      slug: r.slug,
      path: publicPathFromSlug(r.slug),
      title: r.title,
      description: r.description,
      lastModified: r.lastModified,
      components: r.components.map((c) => ({ name: c.name, attrs: c.attrs })),
      internalLinks: r.internalLinks,
      schemas: r.schemas,
      extraJsonLd: extras,
    }, null, 2))
  }

  await writeLlmsTxt(distDir, site, routes, contentByslug)
  await writeAiPlugin(distDir, site)
  await writeManifest(distDir, input)
}

function siteContactEmail(site: SiteConfig) {
  return site.organization?.contact?.email ?? site.contact?.email ?? ''
}

function siteFactLines(site: SiteConfig): string[] {
  const lines: string[] = []
  const sameAs = site.organization?.sameAs ?? site.sameAs ?? []
  const contact = site.organization?.contact ?? site.contact
  const topics = site.topics ?? []

  if (!sameAs.length && !contact && !topics.length) return lines

  lines.push('## Site facts')
  lines.push('')
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
  routes: RouteRecord[],
  contentByslug: Map<string, ContentRoute>,
) {
  const lines: string[] = []
  lines.push(`# ${site.name}`)
  lines.push('')
  lines.push(`> ${site.description}`)
  lines.push('')
  lines.push(...siteFactLines(site))

  const pages = routes.filter((r) => contentByslug.get(r.slug)?.collection !== 'posts' && r.slug !== '404')
  const posts = routes.filter((r) => contentByslug.get(r.slug)?.collection === 'posts')

  if (pages.length) {
    lines.push('## Pages')
    lines.push('')
    for (const r of pages) {
      const url = absoluteUrl(site.url, publicPathFromSlug(r.slug))
      lines.push(`- [${r.title}](${url}): ${r.description}`)
    }
    lines.push('')
  }

  if (posts.length) {
    lines.push('## Posts')
    lines.push('')
    for (const r of posts) {
      const url = absoluteUrl(site.url, publicPathFromSlug(r.slug))
      lines.push(`- [${r.title}](${url}): ${r.description}`)
    }
    lines.push('')
  }

  await writeFile(join(distDir, 'llms.txt'), lines.join('\n'))

  // llms-full.txt: include markdown bodies for content routes
  const full: string[] = [...lines]
  for (const r of routes) {
    const content = contentByslug.get(r.slug)
    if (!content) continue
    full.push('---')
    full.push('')
    full.push(`# ${r.title}`)
    full.push('')
    full.push(`URL: ${absoluteUrl(site.url, publicPathFromSlug(r.slug))}`)
    full.push('')
    full.push(content.markdown ?? '')
    full.push('')
  }
  await writeFile(join(distDir, 'llms-full.txt'), full.join('\n'))
}

async function writeAiPlugin(distDir: string, site: SiteConfig) {
  const wellKnown = join(distDir, '.well-known')
  await mkdir(wellKnown, { recursive: true })
  const plugin = {
    schema_version: 'v1',
    name_for_human: site.name,
    name_for_model: site.name.toLowerCase().replace(/\s+/g, '_'),
    description_for_human: site.description,
    description_for_model: `Read ${absoluteUrl(site.url, '/llms.txt')} for a structured index of this site. Per-route JSON at /routes/{slug}.json. Full manifest at /site.manifest.json.`,
    contact_email: siteContactEmail(site),
    legal_info_url: absoluteUrl(site.url, '/'),
    api: {
      type: 'manifest',
      url: absoluteUrl(site.url, '/site.manifest.json'),
    },
  }
  await writeFile(join(wellKnown, 'ai-plugin.json'), JSON.stringify(plugin, null, 2))
}

async function writeManifest(distDir: string, input: DiscoveryInput) {
  const { site, routes, componentSchemas, componentUseCounts } = input
  const manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    generator: {
      name: GENERATOR_NAME,
      version: GENERATOR_VERSION,
    },
    generatedAt: new Date().toISOString(),
    site,
    routes: routes.map((r) => ({
      slug: r.slug,
      path: publicPathFromSlug(r.slug),
      title: r.title,
      description: r.description,
      lastModified: r.lastModified,
      components: r.components.map((c) => ({ name: c.name, attrs: c.attrs })),
      internalLinks: r.internalLinks,
      schemas: r.schemas,
      html: `/routes/${r.slug}.html`,
      json: `/routes/${r.slug}.json`,
    })),
    components: [...componentSchemas.entries()].map(([name, schema]) => ({
      name,
      uses: componentUseCounts.get(name) ?? 0,
      schema,
    })),
  }
  await writeFile(join(distDir, 'site.manifest.json'), JSON.stringify(manifest, null, 2))
}
