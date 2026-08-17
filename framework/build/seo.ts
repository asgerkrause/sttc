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

export type SiteBrand = {
  name?: string
  slogan?: string
  logo?: string
}

export type SiteOffer = {
  price?: string
  priceCurrency?: string
  availability?: string
  url?: string
}

export type SiteProduct = {
  type?: string
  name: string
  description: string
  path: string
  category?: string
  image?: string
  sku?: string
  audience?: string
  offers?: SiteOffer
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
  /** Default social/share image. */
  image?: string
  /** @deprecated Use image. */
  ogImage?: string
  scroll?: 'lenis' | 'native'
  vercel?: {
    analytics?: boolean
    speedInsights?: boolean
  }
  organization?: SiteOrganization
  brand?: SiteBrand
  product?: SiteProduct
  sameAs?: string[]
  contact?: SiteContact
  address?: SiteAddress
  topics?: string[]
  robots?: {
    groups?: RobotsGroup[]
  }
}

export function absoluteUrl(base: string, path: string) {
  if (/^https?:\/\//i.test(path)) return new URL(path).href
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
  const logo = org.logo

  const node: Record<string, unknown> = cleanObject({
    '@type': 'Organization',
    '@id': absoluteUrl(site.url, '/#organization'),
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

function brandNode(site: SiteConfig): JsonLdNode | undefined {
  if (!site.brand) return undefined
  return cleanObject({
    '@type': 'Brand',
    '@id': absoluteUrl(site.url, '/#brand'),
    name: site.brand.name ?? site.name,
    slogan: site.brand.slogan,
    logo: site.brand.logo ? absoluteUrl(site.url, site.brand.logo) : undefined,
  })
}

function productNode(site: SiteConfig, canonical: string): JsonLdNode | undefined {
  const product = site.product
  if (!product || absoluteUrl(site.url, product.path) !== canonical) return undefined
  const offer = product.offers
  return cleanObject({
    '@type': product.type ?? 'Product',
    '@id': `${canonical}#product`,
    name: product.name,
    description: product.description,
    url: canonical,
    image: product.image ? absoluteUrl(site.url, product.image) : undefined,
    sku: product.sku,
    category: product.category,
    audience: product.audience ? { '@type': 'Audience', audienceType: product.audience } : undefined,
    brand: site.brand ? { '@id': absoluteUrl(site.url, '/#brand') } : undefined,
    manufacturer: { '@id': absoluteUrl(site.url, '/#organization') },
    offers: offer ? cleanObject({
      '@type': 'Offer',
      price: offer.price,
      priceCurrency: offer.priceCurrency,
      availability: offer.availability ? `https://schema.org/${offer.availability}` : undefined,
      url: offer.url ? absoluteUrl(site.url, offer.url) : canonical,
    }) : undefined,
  })
}

export type JsonLdNode = Record<string, unknown>

export type RobotsGroup = {
  userAgents: string[]
  allow?: string[]
  disallow?: string[]
}

export function buildSchemaGraph(
  site: SiteConfig,
  page: { title: string; description: string; canonical: string },
  extraNodes: JsonLdNode[] = [],
) {
  const organization = organizationNode(site)
  const brand = brandNode(site)
  const product = productNode(site, page.canonical)

  return {
    '@context': 'https://schema.org',
    '@graph': [
      organization,
      ...(brand ? [brand] : []),
      cleanObject({
        '@type': 'WebSite',
        '@id': absoluteUrl(site.url, '/#website'),
        name: site.name,
        url: site.url,
        publisher: { '@id': absoluteUrl(site.url, '/#organization') },
        sameAs: site.sameAs,
        knowsAbout: site.topics,
      }),
      {
        '@type': 'WebPage',
        '@id': `${page.canonical}#webpage`,
        name: page.title,
        description: page.description,
        url: page.canonical,
        isPartOf: { '@id': absoluteUrl(site.url, '/#website') },
      },
      ...(product ? [product] : []),
      ...extraNodes,
    ],
  }
}

export type PublicRoutePolicy = { slug: string; unlisted?: boolean }

export function isPublicRoute(route: PublicRoutePolicy) {
  return !route.unlisted
}

export type SitemapRoute = string | { slug: string; lastModified?: string; unlisted?: boolean }

function sitemapSlug(route: SitemapRoute) {
  return typeof route === 'string' ? route : route.slug
}

function sitemapLastModified(route: SitemapRoute) {
  return typeof route === 'string' ? undefined : route.lastModified
}

export async function writeSitemap(distDir: string, siteUrl: string, routes: SitemapRoute[]) {
  const entries = new Map<string, string | undefined>()
  for (const route of routes) {
    const slug = sitemapSlug(route)
    if (slug === '404' || !isPublicRoute(typeof route === 'string' ? { slug: route } : route)) continue
    entries.set(publicPathFromSlug(slug), sitemapLastModified(route))
  }

  const lines = [...entries.entries()].map(([path, lastModified]) => {
    const lastmod = lastModified ? `<lastmod>${lastModified}</lastmod>` : ''
    return `  <url><loc>${absoluteUrl(siteUrl, path)}</loc>${lastmod}</url>`
  })
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${lines.join('\n')}
</urlset>
`
  await writeFile(join(distDir, 'sitemap.xml'), xml)
}

export async function writeRobots(distDir: string, siteUrl: string, groups: RobotsGroup[] = []) {
  const sitemap = absoluteUrl(siteUrl, '/sitemap.xml')
  const configured = groups.length ? groups : [{ userAgents: ['*'], allow: ['/'] }]
  const lines = configured.flatMap((group, index) => [
    ...(index ? [''] : []),
    ...group.userAgents.map((agent) => `User-agent: ${agent}`),
    ...(group.allow ?? []).map((path) => `Allow: ${path}`),
    ...(group.disallow ?? []).map((path) => `Disallow: ${path}`),
  ])
  await writeFile(join(distDir, 'robots.txt'), `${lines.join('\n')}\n\nSitemap: ${sitemap}\n`)
}
