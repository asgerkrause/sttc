import { describe, expect, test } from 'bun:test'
import type { Composer } from '../build/compose'
import { BuildError } from '../build/errors'
import { RouteGraph } from '../build/route-graph'

function graph() {
  return new RouteGraph({ composer: { prepareRoute: async () => ({ html: '', unlisted: false }) } as unknown as Composer })
}

describe('route ownership', () => {
  test('registers route owners and returns sorted slugs', () => {
    const routes = graph()

    routes.register({ slug: 'work/case', kind: 'static', source: 'src/pages/work/case.html' })
    routes.register({ slug: 'index', kind: 'static', source: 'src/pages/index.html' })

    expect(routes.slugs()).toEqual(['index', 'work/case'])
    expect(routes.get('work/case')?.source).toBe('src/pages/work/case.html')
  })

  test('fails when two authored pages map to the same slug', () => {
    const routes = graph()

    routes.register({ slug: 'about', kind: 'static', source: 'src/pages/about.html' })

    expect(() => routes.register({ slug: 'about', kind: 'static', source: 'src/pages/about/index.html' })).toThrow(BuildError)
  })

  test('fails when content collides with authored static route', () => {
    const routes = graph()

    routes.register({ slug: 'about', kind: 'static', source: 'src/pages/about.html' })

    expect(() => routes.register({ slug: 'about', kind: 'content', source: 'content/pages/about.md' })).toThrow(BuildError)
  })

  test('fails when generated indexes collide with authored routes', () => {
    const routes = graph()

    routes.register({ slug: 'tags', kind: 'static', source: 'src/pages/tags.html' })

    expect(() => routes.register({ slug: 'tags', kind: 'generated', source: 'generated:tags' })).toThrow(BuildError)
  })
})
