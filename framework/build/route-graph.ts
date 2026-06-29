import { mkdir, writeFile } from 'fs/promises'
import { isAbsolute, join } from 'path'
import type { Composer, ComposeInstance } from './compose'
import type { TemplateContext } from './template-directives'
import {
  extractDescription,
  extractTitle,
  scanInternalLinks,
  type RouteRecord,
} from './discovery'
import { dist, root } from './paths'
import { RouteRegistry, type RouteOwner } from './routes'
import { publicPathFromSlug } from '../runtime/lib/paths.js'
import { sourceLastModified } from './source-files'

export type RouteGraphOptions = {
  composer: Composer
  instancesFor?: (slug: string) => ComposeInstance[]
  distDir?: string
  sourceRoot?: string
}

export type RouteComposeOptions = {
  schemas?: string[]
  lastModified?: string
  headLinks?: string[]
  data?: TemplateContext
}

export type ComposedRoute = {
  slug: string
  outFile: string
  html: string
}

export class RouteGraph {
  #registry = new RouteRegistry()
  #records: RouteRecord[] = []
  #composed: ComposedRoute[] = []
  #composer: Composer
  #instancesFor: (slug: string) => ComposeInstance[]
  #distDir: string
  #sourceRoot: string

  constructor(options: RouteGraphOptions) {
    this.#composer = options.composer
    this.#instancesFor = options.instancesFor ?? (() => [])
    this.#distDir = options.distDir ?? dist
    this.#sourceRoot = options.sourceRoot ?? root
  }

  async #sourceLastModified(source: string) {
    if (source.startsWith('generated:')) return undefined
    return sourceLastModified(isAbsolute(source) ? source : join(this.#sourceRoot, source))
  }

  #linkedLastModified(links: string[]) {
    const modified = new Map(this.#records.map((record) => [publicPathFromSlug(record.slug), record.lastModified]))
    return links
      .map((link) => modified.get(link))
      .filter((value): value is string => !!value)
      .sort()
      .at(-1)
  }

  async compose(owner: RouteOwner, body: string, options: RouteComposeOptions = {}) {
    const route = this.#registry.register(owner)
    const html = await this.#composer.prepareRouteSource(body, {
      slug: route.slug,
      fileHint: route.source,
      headLinks: options.headLinks,
      data: options.data,
    })
    const outPath = join(this.#distDir, 'routes', route.outFile)
    await mkdir(join(outPath, '..'), { recursive: true })
    await writeFile(outPath, html)
    this.#composed.push({ slug: route.slug, outFile: route.outFile, html })

    const internalLinks = scanInternalLinks(html)
    let lastModified = options.lastModified
    if (!lastModified) lastModified = await this.#sourceLastModified(route.source)
    if (!lastModified) lastModified = this.#linkedLastModified(internalLinks)
    this.#records.push({
      slug: route.slug,
      title: extractTitle(html),
      description: extractDescription(html),
      components: this.#instancesFor(route.slug),
      internalLinks,
      schemas: options.schemas ?? ['WebPage'],
      lastModified,
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

  composedRoutes() {
    return [...this.#composed]
  }
}
