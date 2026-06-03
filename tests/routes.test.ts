import { describe, expect, test } from 'bun:test'
import { BuildError } from '../build/errors'
import { RouteRegistry } from '../build/routes'

describe('route ownership registry', () => {
  test('registers route owners and returns sorted slugs', () => {
    const routes = new RouteRegistry()

    routes.register({ slug: 'work/case', kind: 'static', source: 'src/pages/work/case.html' })
    routes.register({ slug: 'index', kind: 'static', source: 'src/pages/index.html' })

    expect(routes.slugs()).toEqual(['index', 'work/case'])
    expect(routes.get('work/case')?.outFile).toBe('work/case.html')
  })

  test('lets preferred src/pages replace legacy src/routes for same slug', () => {
    const routes = new RouteRegistry()

    routes.register({ slug: 'about', kind: 'legacy-static', source: 'src/routes/about.html' })
    routes.register({ slug: 'about', kind: 'static', source: 'src/pages/about.html' })

    expect(routes.get('about')?.source).toBe('src/pages/about.html')
    expect(routes.get('about')?.kind).toBe('static')
  })

  test('fails when content collides with authored static route', () => {
    const routes = new RouteRegistry()

    routes.register({ slug: 'about', kind: 'static', source: 'src/pages/about.html' })

    expect(() => routes.register({ slug: 'about', kind: 'content', source: 'content/pages/about.md' })).toThrow(BuildError)
  })

  test('fails when generated indexes collide with authored routes', () => {
    const routes = new RouteRegistry()

    routes.register({ slug: 'tags', kind: 'static', source: 'src/pages/tags.html' })

    expect(() => routes.register({ slug: 'tags', kind: 'generated', source: 'generated:tags' })).toThrow(BuildError)
  })
})
