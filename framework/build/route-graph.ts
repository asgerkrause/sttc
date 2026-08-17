import { mkdir, writeFile } from 'fs/promises'
import { isAbsolute, join } from 'path'
import type { Composer, ComposeInstance } from './compose'
import type { TemplateContext } from './template-directives'
import {
  extractRouteMetadata,
  type RouteRecord,
} from './discovery'
import { dist, root } from './paths'
import { RouteRegistry, type RouteOwner } from './routes'
import { publicPathFromSlug } from '../runtime/lib/paths.js'
import { sourceLastModified } from './source-files'

type RouteComposer = Pick<Composer, 'prepareRoute'>

export type RouteGraphOptions = {
  composer: RouteComposer
  instancesFor?: (slug: string) => ComposeInstance[]
  distDir?: string
  sourceRoot?: string
}

export type RouteComposeOptions = {
  schemas?: string[]
  lastModified?: string
  headLinks?: string[]
  data?: TemplateContext
  index?: number
}

export type ComposedRoute = {
  slug: string
  outFile: string
  html: string
}

export class RouteGraph {
  #registry = new RouteRegistry()
  #records: Array<RouteRecord | undefined> = []
  #modifiedByPath = new Map<string, string | undefined>()
  #composed: Array<ComposedRoute | undefined> = []
  #nextIndex = 0
  #composer: RouteComposer
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
    return links
      .map((link) => this.#modifiedByPath.get(link))
      .filter((value): value is string => !!value)
      .sort()
      .at(-1)
  }

  register(owner: RouteOwner) {
    return this.#registry.register(owner)
  }

  async compose(owner: RouteOwner, body: string, options: RouteComposeOptions = {}) {
    const route = this.#registry.get(owner.slug) ?? this.#registry.register(owner)
    const input = {
      slug: route.slug,
      fileHint: route.source,
      headLinks: options.headLinks,
      data: options.data,
    }
    const { html, unlisted } = await this.#composer.prepareRoute(body, input)
    const outPath = join(this.#distDir, 'routes', route.outFile)
    await mkdir(join(outPath, '..'), { recursive: true })
    await writeFile(outPath, html)

    const { title, description, internalLinks, schemas } = extractRouteMetadata(html)
    let lastModified = options.lastModified
    if (!lastModified) lastModified = await this.#sourceLastModified(route.source)
    if (!lastModified) lastModified = this.#linkedLastModified(internalLinks)
    const index = options.index ?? this.#nextIndex++
    if (index >= this.#nextIndex) this.#nextIndex = index + 1
    this.#composed[index] = { slug: route.slug, outFile: route.outFile, html }
    this.#records[index] = {
      slug: route.slug,
      title,
      description,
      components: this.#instancesFor(route.slug),
      internalLinks,
      schemas: [...new Set([...(options.schemas ?? ['WebPage']), ...schemas])],
      unlisted,
      renderedHtml: html,
      lastModified,
    }
    this.#modifiedByPath.set(publicPathFromSlug(route.slug), lastModified)

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
    return this.#records.filter((record): record is RouteRecord => !!record)
  }

  composedRoutes() {
    return this.#composed.filter((route): route is ComposedRoute => !!route)
  }
}
