import type { Composer, ComposeInstance } from './compose'
import type { TemplateContext } from './template-directives'
import {
  extractRouteMetadata,
  type RouteRecord,
} from './discovery'
import { BuildError } from './errors'

type RouteComposer = Pick<Composer, 'prepareRoute'>

export type RouteKind = 'static' | 'legacy-static' | 'content' | 'generated'

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
  #records: Array<RouteRecord | undefined> = []
  #nextIndex = 0
  #composer: RouteComposer
  #instancesFor: (slug: string) => ComposeInstance[]

  constructor(options: RouteGraphOptions) {
    this.#composer = options.composer
    this.#instancesFor = options.instancesFor ?? (() => [])
  }

  register(owner: RouteOwner) {
    const existing = this.#routes.get(owner.slug)
    // Preferred src/pages static routes intentionally replace legacy src/routes routes.
    if (!existing || (existing.kind === 'legacy-static' && owner.kind === 'static')) {
      this.#routes.set(owner.slug, owner)
      return owner
    }

    throw new BuildError(`Duplicate route slug "${owner.slug}"`, {
      file: owner.source,
      hint: `${owner.source} (${owner.kind}) conflicts with ${existing.source} (${existing.kind}) at /${owner.slug === 'index' ? '' : `${owner.slug}/`}`,
    })
  }

  async compose(owner: RouteOwner, body: string, options: RouteComposeOptions = {}) {
    const existing = this.#routes.get(owner.slug)
    // Only the registered owner may compose its slug; anyone else hits the duplicate check.
    const route = existing && existing.kind === owner.kind && existing.source === owner.source ? existing : this.register(owner)
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
