import { writeFile } from 'fs/promises'
import { join } from 'path'
import { publicPathFromSlug } from '../runtime/lib/paths.js'

export type SiteContact = {
  email?: string
  telephone?: string
  url?: string
}

export type SiteAddress = {
  streetAddress?: string
  addressLocality?: string
  addressRegion?: string
  postalCode?: string
  addressCountry?: string
}

export type SiteOrganization = {
  name?: string
  legalName?: string
  logo?: string
  sameAs?: string[]
  contact?: SiteContact
  address?: SiteAddress
}

export type SiteConfig = {
  name: string
  url: string
  description: string
  locale?: string
  twitter?: string
  ogImage?: string
  scroll?: 'lenis' | 'native'
  vercel?: {
    analytics?: boolean
    speedInsights?: boolean
  }
  organization?: SiteOrganization
  sameAs?: string[]
  contact?: SiteContact
  address?: SiteAddress
  topics?: string[]
}

export function absoluteUrl(base: string, path: string) {
  return new URL(path.startsWith('/') ? path : `/${path}`, base).href
}

function cleanObject<T extends Record<string, unknown>>(value: T): T {
  for (const key of Object.keys(value)) {
    const current = value[key]
    if (current === undefined || current === '' || (Array.isArray(current) && current.length === 0)) {
      delete value[key]
    }
  }
  return value
}

function organizationNode(site: SiteConfig): Record<string, unknown> {
  const org = site.organization ?? {}
  const contact = org.contact ?? site.contact
  const address = org.address ?? site.address
  const sameAs = org.sameAs ?? site.sameAs
  const logo = org.logo ?? site.ogImage

  const node: Record<string, unknown> = cleanObject({
    '@type': 'Organization',
    name: org.name ?? site.name,
    legalName: org.legalName,
    url: site.url,
    logo: logo ? absoluteUrl(site.url, logo) : undefined,
    sameAs,
    contactPoint: contact ? cleanObject({
      '@type': 'ContactPoint',
      email: contact.email,
      telephone: contact.telephone,
      url: contact.url ? absoluteUrl(site.url, contact.url) : undefined,
    }) : undefined,
    address: address ? cleanObject({ '@type': 'PostalAddress', ...address }) : undefined,
  })

  return node
}

export function buildSchemaGraph(
  site: SiteConfig,
  page: { title: string; description: string; canonical: string },
) {
  const organization = organizationNode(site)

  return {
    '@context': 'https://schema.org',
    '@graph': [
      organization,
      cleanObject({
        '@type': 'WebSite',
        name: site.name,
        url: site.url,
        publisher: { '@type': 'Organization', url: site.url },
        sameAs: site.sameAs,
        knowsAbout: site.topics,
      }),
      {
        '@type': 'WebPage',
        name: page.title,
        description: page.description,
        url: page.canonical,
        isPartOf: { '@type': 'WebSite', url: site.url },
      },
    ],
  }
}

export async function writeSitemap(distDir: string, siteUrl: string, slugs: string[]) {
  const paths = [...new Set(slugs.filter((s) => s !== '404').map(publicPathFromSlug))]
  const lines = paths.map((p) => `  <url><loc>${absoluteUrl(siteUrl, p)}</loc></url>`)
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${lines.join('\n')}
</urlset>
`
  await writeFile(join(distDir, 'sitemap.xml'), xml)
}

export async function writeRobots(distDir: string, siteUrl: string) {
  const sitemap = absoluteUrl(siteUrl, '/sitemap.xml')
  await writeFile(
    join(distDir, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`,
  )
}
