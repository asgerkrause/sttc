import { writeFile } from 'fs/promises'
import { join } from 'path'
import { publicPathFromSlug } from '../lib/paths.js'

export type SiteConfig = {
  name: string
  url: string
  description: string
  locale?: string
  twitter?: string
  ogImage?: string
  scroll?: 'lenis' | 'native'
}

export function absoluteUrl(base: string, path: string) {
  return new URL(path.startsWith('/') ? path : `/${path}`, base).href
}

export function buildSchemaGraph(
  site: SiteConfig,
  page: { title: string; description: string; canonical: string },
) {
  const organization: Record<string, unknown> = {
    '@type': 'Organization',
    name: site.name,
    url: site.url,
  }
  if (site.ogImage) organization.logo = absoluteUrl(site.url, site.ogImage)

  return {
    '@context': 'https://schema.org',
    '@graph': [
      organization,
      {
        '@type': 'WebSite',
        name: site.name,
        url: site.url,
        publisher: { '@type': 'Organization', url: site.url },
      },
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
