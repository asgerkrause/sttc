import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { compileContentFrom } from '../build/content'
import { BuildError } from '../build/errors'
import { writeDiscovery } from '../build/discovery'

async function withProject(fn: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'snz-content-'))
  try {
    await mkdir(join(dir, 'src', 'templates'), { recursive: true })
    await mkdir(join(dir, 'content'), { recursive: true })
    await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function writeCollectionConfig(dir: string, collections: unknown[]) {
  await writeFile(join(dir, 'content', 'collections.json'), JSON.stringify({ collections }, null, 2))
}

describe('custom content collections', () => {
  test('keeps built-in posts and pages implicit when no custom config exists', async () => {
    await withProject(async (dir) => {
      await mkdir(join(dir, 'content', 'posts'), { recursive: true })
      await mkdir(join(dir, 'content', 'pages'), { recursive: true })
      await writeFile(join(dir, 'src', 'templates', 'post.html'), '<h1>{{title}}</h1>{{body}}')
      await writeFile(join(dir, 'src', 'templates', 'page.html'), '<h1>{{title}}</h1>{{body}}')
      await writeFile(join(dir, 'content', 'posts', 'hello-world.md'), '---\ntitle: Hello\ndescription: Post\n---\nPost body')
      await writeFile(join(dir, 'content', 'pages', 'about.md'), '---\ntitle: About\n---\nPage body')

      const routes = await compileContentFrom({ rootDir: dir, includeDrafts: false })

      expect(routes.map((route) => [route.collection, route.slug, route.routeFile])).toEqual([
        ['posts', 'insights/hello-world', 'insights/hello-world.html'],
        ['pages', 'about', 'about.html'],
      ])
    })
  })

  test('compiles configured project collection through custom template', async () => {
    await withProject(async (dir) => {
      await mkdir(join(dir, 'content', 'projects'), { recursive: true })
      await writeCollectionConfig(dir, [{
        name: 'projects',
        label: 'Projects',
        path: 'content/projects',
        template: 'project.html',
        route: 'work/{slug}',
        required: ['title', 'client'],
      }])
      await writeFile(join(dir, 'src', 'templates', 'project.html'), '<article data-collection="{{collection}}" data-base="{{basename}}"><h1>{{title}}</h1><p>{{client}}</p>{{body}}</article>')
      await writeFile(join(dir, 'content', 'projects', 'acme.md'), '---\ntitle: Acme Redesign\nclient: Acme\ndescription: Case study\n---\n## Challenge\n\nShip fast.')

      const routes = await compileContentFrom({ rootDir: dir, includeDrafts: false })
      const project = routes[0]

      expect(project.slug).toBe('work/acme')
      expect(project.routeFile).toBe('work/acme.html')
      expect(project.source).toBe('content/projects/acme.md')
      expect(project.collection).toBe('projects')
      expect(project.body).toContain('data-collection="projects"')
      expect(project.body).toContain('data-base="acme"')
      expect(project.body).toContain('<h2 id="challenge">Challenge</h2>')
    })
  })

  test('rejects invalid custom route patterns', async () => {
    await withProject(async (dir) => {
      await writeCollectionConfig(dir, [{
        name: 'projects',
        path: 'content/projects',
        template: 'project.html',
        route: 'work',
      }])

      await expect(compileContentFrom({ rootDir: dir })).rejects.toThrow(BuildError)
      await expect(compileContentFrom({ rootDir: dir })).rejects.toThrow('exactly one {slug}')
    })
  })

  test('rejects custom collections using reserved built-in names', async () => {
    await withProject(async (dir) => {
      await writeCollectionConfig(dir, [{
        name: 'posts',
        path: 'content/projects',
        template: 'project.html',
        route: 'work/{slug}',
      }])

      await expect(compileContentFrom({ rootDir: dir })).rejects.toThrow('reserved')
    })
  })

  test('rejects custom collections outside content ownership', async () => {
    await withProject(async (dir) => {
      await writeCollectionConfig(dir, [{
        name: 'projects',
        path: 'src/pages',
        template: 'project.html',
        route: 'work/{slug}',
      }])

      await expect(compileContentFrom({ rootDir: dir })).rejects.toThrow('non-built-in content subfolder')
    })
  })

  test('rejects custom collections reusing built-in content paths', async () => {
    await withProject(async (dir) => {
      await writeCollectionConfig(dir, [{
        name: 'projects',
        path: 'content/posts',
        template: 'project.html',
        route: 'work/{slug}',
      }])

      await expect(compileContentFrom({ rootDir: dir })).rejects.toThrow('non-built-in content subfolder')
    })
  })

  test('checks custom required front-matter fields', async () => {
    await withProject(async (dir) => {
      await mkdir(join(dir, 'content', 'projects'), { recursive: true })
      await writeCollectionConfig(dir, [{
        name: 'projects',
        path: 'content/projects',
        template: 'project.html',
        route: 'work/{slug}',
        required: ['title', 'client'],
      }])
      await writeFile(join(dir, 'src', 'templates', 'project.html'), '<h1>{{title}}</h1>{{body}}')
      await writeFile(join(dir, 'content', 'projects', 'acme.md'), '---\ntitle: Acme\n---\nBody')

      await expect(compileContentFrom({ rootDir: dir })).rejects.toThrow('missing "client"')
    })
  })

  test('custom content stays WebPage discovery, not BlogPosting', async () => {
    await withProject(async (dir) => {
      const distDir = join(dir, 'dist')
      await writeDiscovery(distDir, {
        site: {
          name: 'Example',
          url: 'https://example.com',
          description: 'Example site.',
        },
        routes: [{
          slug: 'work/acme',
          title: 'Acme',
          description: 'Case study.',
          components: [],
          internalLinks: [],
          schemas: ['WebPage'],
        }],
        componentSchemas: new Map(),
        componentUseCounts: new Map(),
        contentByslug: new Map([['work/acme', {
          slug: 'work/acme',
          routeFile: 'work/acme.html',
          body: '',
          source: 'content/projects/acme.md',
          data: { title: 'Acme' },
          collection: 'projects',
          markdown: 'Body',
          tags: [],
          draft: false,
        }]]),
      })

      const route = JSON.parse(await readFile(join(distDir, 'routes', 'work', 'acme.json'), 'utf8'))
      expect(route.schemas).toEqual(['WebPage'])
      expect(route.extraJsonLd.map((item: { '@type': string }) => item['@type'])).not.toContain('BlogPosting')
    })
  })
})
