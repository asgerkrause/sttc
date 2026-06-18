import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import type { Composer, ComposeInstance } from './compose'
import {
  extractDescription,
  extractTitle,
  scanInternalLinks,
  type RouteRecord,
} from './discovery'
import { dist } from './paths'
import { RouteRegistry, type RouteOwner } from './routes'

export type RouteGraphOptions = {
  composer: Composer
  instancesFor?: (slug: string) => ComposeInstance[]
  distDir?: string
}

export type RouteComposeOptions = {
  schemas?: string[]
  lastModified?: string
}

export class RouteGraph {
  #registry = new RouteRegistry()
  #records: RouteRecord[] = []
  #composer: Composer
  #instancesFor: (slug: string) => ComposeInstance[]
  #distDir: string

  constructor(options: RouteGraphOptions) {
    this.#composer = options.composer
    this.#instancesFor = options.instancesFor ?? (() => [])
    this.#distDir = options.distDir ?? dist
  }

  async compose(owner: RouteOwner, body: string, options: RouteComposeOptions = {}) {
    const route = this.#registry.register(owner)
    const html = await this.#composer.prepareRouteSource(body, {
      slug: route.slug,
      fileHint: route.source,
    })
    const outPath = join(this.#distDir, 'routes', route.outFile)
    await mkdir(join(outPath, '..'), { recursive: true })
    await writeFile(outPath, html)

    this.#records.push({
      slug: route.slug,
      title: extractTitle(html),
      description: extractDescription(html),
      components: this.#instancesFor(route.slug),
      internalLinks: scanInternalLinks(html),
      schemas: options.schemas ?? ['WebPage'],
      lastModified: options.lastModified ?? new Date().toISOString(),
    })

    return { route, html }
  }

  has(slug: string) {
    return this.#registry.has(slug)
  }

  slugs() {
    return this.#registry.slugs()
  }

  routes() {
    return this.#registry.routes()
  }

  records() {
    return [...this.#records]
  }
}
