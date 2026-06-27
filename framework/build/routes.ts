import { BuildError } from './errors'
import { outFileFromSlug } from './source-files'

export type RouteKind = 'static' | 'legacy-static' | 'content' | 'generated'

export type RouteOwner = {
  slug: string
  kind: RouteKind
  source: string
  outFile?: string
}

export class RouteRegistry {
  #routes = new Map<string, Required<RouteOwner>>()

  register(owner: RouteOwner) {
    const normalized: Required<RouteOwner> = {
      ...owner,
      outFile: owner.outFile ?? outFileFromSlug(owner.slug),
    }
    const existing = this.#routes.get(normalized.slug)
    if (!existing) {
      this.#routes.set(normalized.slug, normalized)
      return normalized
    }

    // Preferred src/pages static routes intentionally replace legacy src/routes routes.
    if (existing.kind === 'legacy-static' && normalized.kind === 'static') {
      this.#routes.set(normalized.slug, normalized)
      return normalized
    }

    throw new BuildError(`Duplicate route slug "${normalized.slug}"`, {
      file: normalized.source,
      hint: `${normalized.source} (${normalized.kind}) conflicts with ${existing.source} (${existing.kind}) at /${normalized.slug === 'index' ? '' : `${normalized.slug}/`}`,
    })
  }

  get(slug: string) {
    return this.#routes.get(slug)
  }

  has(slug: string) {
    return this.#routes.has(slug)
  }

  slugs() {
    return [...this.#routes.keys()].sort()
  }

  routes() {
    return [...this.#routes.values()].sort((a, b) => a.slug.localeCompare(b.slug))
  }
}
