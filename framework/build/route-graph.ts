import type { Composer, ComposeInstance } from './compose'
import type { TemplateContext } from './template-directives'
import {
  extractRouteMetadata,
  type RouteRecord,
} from './discovery'
import { BuildError } from './errors'

type RouteComposer = Pick<Composer, 'prepareRoute'>

export type RouteKind = 'static' | 'content' | 'generated'

export type RouteOwner = {
  slug: string
  kind: RouteKind
  source: string
}

export type RouteGraphOptions = {
  composer: RouteComposer
  instancesFor?: (slug: string) => ComposeInstance[]
}

export type RouteComposeOptions = {
  schemas?: string[]
  lastModified?: string
  headLinks?: string[]
  data?: TemplateContext
  index?: number
}

export class RouteGraph {
  #routes = new Map<string, RouteOwner>()
  #composed = new Set<string>()
  #records: Array<RouteRecord | undefined> = []
  #nextIndex = 0
  #composer: RouteComposer
  #instancesFor: (slug: string) => ComposeInstance[]

  constructor(options: RouteGraphOptions) {
    this.#composer = options.composer
    this.#instancesFor = options.instancesFor ?? (() => [])
  }

  #duplicate(owner: RouteOwner, existing: RouteOwner) {
    return new BuildError(`Duplicate route slug "${owner.slug}"`, {
      file: owner.source,
      hint: `${owner.source} (${owner.kind}) conflicts with ${existing.source} (${existing.kind}) at /${owner.slug === 'index' ? '' : `${owner.slug}/`}`,
    })
  }

  register(owner: RouteOwner) {
    const existing = this.#routes.get(owner.slug)
    if (existing) throw this.#duplicate(owner, existing)
    this.#routes.set(owner.slug, owner)
    return owner
  }

  async compose(owner: RouteOwner, body: string, options: RouteComposeOptions = {}) {
    const existing = this.#routes.get(owner.slug)
    // A slug composes once, by its registered owner; anything else is a duplicate route.
    if (existing && this.#composed.has(owner.slug)) throw this.#duplicate(owner, existing)
    const route = existing && existing.kind === owner.kind && existing.source === owner.source ? existing : this.register(owner)
    this.#composed.add(route.slug)
    const { html, unlisted } = await this.#composer.prepareRoute(body, {
      slug: route.slug,
      fileHint: route.source,
      headLinks: options.headLinks,
      data: options.data,
    })

    const { title, description, internalLinks, schemas } = extractRouteMetadata(html)
    const index = options.index ?? this.#nextIndex++
    if (index >= this.#nextIndex) this.#nextIndex = index + 1
    this.#records[index] = {
      slug: route.slug,
      title,
      description,
      components: this.#instancesFor(route.slug),
      internalLinks,
      schemas: [...new Set([...(options.schemas ?? ['WebPage']), ...schemas])],
      unlisted,
      renderedHtml: html,
      lastModified: options.lastModified,
    }

    return { route, html }
  }

  get(slug: string) {
    return this.#routes.get(slug)
  }

  slugs() {
    return [...this.#routes.keys()].sort()
  }

  records() {
    return this.#records.filter((record): record is RouteRecord => !!record)
  }
}
