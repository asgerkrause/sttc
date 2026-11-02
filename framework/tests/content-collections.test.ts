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
  test('defaults posts to /insights/ and rejects generic CMS pages loudly', async () => {
    await withProject(async (dir) => {
      await mkdir(join(dir, 'content', 'posts'), { recursive: true })
      await mkdir(join(dir, 'content', 'pages'), { recursive: true })
      await writeFile(join(dir, 'src', 'templates', 'post.html'), '<h1>{{title}}</h1>{{body}}')
      await writeFile(join(dir, 'content', 'posts', 'hello-world.md'), '---\ntitle: Hello\ndate: 2026-05-26\ndescription: Post\n---\nPost body')
      await writeFile(join(dir, 'content', 'pages', 'about.md'), '---\ntitle: About\n---\nPage body')

      await expect(compileContentFrom({ rootDir: dir, includeDrafts: false })).rejects.toThrow('Generic CMS pages are not supported')
      await rm(join(dir, 'content', 'pages', 'about.md'))

      const routes = await compileContentFrom({ rootDir: dir, includeDrafts: false })
      expect(routes.map((route) => [route.collection, route.slug, route.routeFile])).toEqual([
        ['posts', 'insights/hello-world', 'insights/hello-world.html'],
      ])
    })
  })

  test('escapes front-matter values before template substitution', async () => {
    await withProject(async (dir) => {
      await mkdir(join(dir, 'content', 'posts'), { recursive: true })
      await writeFile(join(dir, 'src', 'templates', 'post.html'), '<article data-title="{{title}}"><h1>{{title}}</h1><p>{{description}}</p>{{body}}</article>')
      await writeFile(join(dir, 'content', 'posts', 'safe-post.md'), '---\ntitle: Bad \"><img src=x onerror=alert(1)>\ndate: 2026-05-26\ndescription: Use <script>alert(1)</script> & keep safe\n---\nBody')

      const [route] = await compileContentFrom({ rootDir: dir, includeDrafts: false })

      expect(route.body).not.toContain('<img src=x')
      expect(route.body).not.toContain('<script>alert(1)</script>')
      expect(route.body).toContain('data-title="Bad &quot;&gt;&lt;img src=x onerror=alert(1)&gt;"')
      expect(route.body).toContain('Use &lt;script&gt;alert(1)&lt;/script&gt; &amp; keep safe')
    })
  })

  test('rejects unsafe built-in content filenames', async () => {
    await withProject(async (dir) => {
      await mkdir(join(dir, 'content', 'posts'), { recursive: true })
      await writeFile(join(dir, 'src', 'templates', 'post.html'), '<h1>{{title}}</h1>{{body}}')
      await writeFile(join(dir, 'content', 'posts', 'Hello World.md'), '---\ntitle: Hello\n---\nBody')

      await expect(compileContentFrom({ rootDir: dir })).rejects.toThrow('Unsafe content filename slug "Hello World"')
    })
  })

  test('rejects built-in posts missing date with file line and hint', async () => {
    await withProject(async (dir) => {
      await mkdir(join(dir, 'content', 'posts'), { recursive: true })
      await writeFile(join(dir, 'src', 'templates', 'post.html'), '<h1>{{title}}</h1>{{body}}')
      await writeFile(join(dir, 'content', 'posts', 'missing-date.md'), '---\ntitle: Missing date\ndescription: Needs a date.\n---\nBody')

      try {
        await compileContentFrom({ rootDir: dir })
        throw new Error('expected missing date BuildError')
      } catch (err) {
        expect(err).toBeInstanceOf(BuildError)
        const build = err as BuildError
        expect(build.message).toContain('missing "date"')
        expect(build.file).toBe('content/posts/missing-date.md')
        expect(build.line).toBe(1)
        expect(build.hint).toContain('date: YYYY-MM-DD')
      }
    })
  })

  test('rejects built-in posts missing description with file line and hint', async () => {
    await withProject(async (dir) => {
      await mkdir(join(dir, 'content', 'posts'), { recursive: true })
      await writeFile(join(dir, 'src', 'templates', 'post.html'), '<h1>{{title}}</h1>{{body}}')
      await writeFile(join(dir, 'content', 'posts', 'missing-description.md'), '---\ntitle: Missing description\ndate: 2026-05-26\n---\nBody')

      try {
        await compileContentFrom({ rootDir: dir })
        throw new Error('expected missing description BuildError')
      } catch (err) {
        expect(err).toBeInstanceOf(BuildError)
        const build = err as BuildError
        expect(build.message).toContain('missing "description"')
        expect(build.file).toBe('content/posts/missing-description.md')
        expect(build.hint).toContain('description:')
      }
    })
  })

  test('rejects built-in posts with invalid date with file line and hint', async () => {
    await withProject(async (dir) => {
      await mkdir(join(dir, 'content', 'posts'), { recursive: true })
      await writeFile(join(dir, 'src', 'templates', 'post.html'), '<h1>{{title}}</h1>{{body}}')
      await writeFile(join(dir, 'content', 'posts', 'bad-date.md'), '---\ntitle: Bad date\ndate: 2026-02-31\ndescription: Invalid calendar day.\n---\nBody')

      try {
        await compileContentFrom({ rootDir: dir })
        throw new Error('expected invalid date BuildError')
      } catch (err) {
        expect(err).toBeInstanceOf(BuildError)
        const build = err as BuildError
        expect(build.message).toContain('invalid "date"')
        expect(build.file).toBe('content/posts/bad-date.md')
        expect(build.line).toBe(3)
        expect(build.hint).toContain('real calendar date')
      }
    })
  })

  test('rejects unsafe front-matter slug overrides with the line', async () => {
    await withProject(async (dir) => {
      await mkdir(join(dir, 'content', 'posts'), { recursive: true })
      await writeFile(join(dir, 'src', 'templates', 'post.html'), '<h1>{{title}}</h1>{{body}}')
      await writeFile(join(dir, 'content', 'posts', 'hello-world.md'), '---\ntitle: Hello\nslug: Not Safe\n---\nBody')

      await expect(compileContentFrom({ rootDir: dir })).rejects.toThrow('Unsafe front-matter slug "Not Safe"')
    })
  })

  test('normalizes nested CMS media refs to optimized image basename', async () => {
    await withProject(async (dir) => {
      await mkdir(join(dir, 'content', 'posts'), { recursive: true })
      await writeFile(join(dir, 'src', 'templates', 'post.html'), '<img src="{{image}}">{{body}}')
      await writeFile(join(dir, 'content', 'posts', 'media-post.md'), '---\ntitle: Media\ndate: 2026-05-26\ndescription: Nested media.\nimage: /src/images/projects/hero.png\n---\n![Alt](/assets/images/nested/team.jpg)')

      const [route] = await compileContentFrom({ rootDir: dir, includeDrafts: false })

      expect(route.data.image).toBe('/assets/images/hero.webp')
      expect(route.body).toContain('src="/assets/images/hero.webp"')
      expect(route.body).toContain('src="/assets/images/team.webp"')
    })
  })

  test('rejects unsupported CMS media extensions in front-matter and body', async () => {
    await withProject(async (dir) => {
      await mkdir(join(dir, 'content', 'posts'), { recursive: true })
      await writeFile(join(dir, 'src', 'templates', 'post.html'), '<h1>{{title}}</h1>{{body}}')
      await writeFile(join(dir, 'content', 'posts', 'bad-media.md'), '---\ntitle: Bad media\ndate: 2026-05-26\ndescription: Bad media.\nimage: /src/images/file.svg\n---\nBody')

      await expect(compileContentFrom({ rootDir: dir })).rejects.toThrow('Unsupported CMS media reference "/src/images/file.svg"')
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

  test('renders content template each blocks from front-matter arrays', async () => {
    await withProject(async (dir) => {
      await mkdir(join(dir, 'content', 'projects'), { recursive: true })
      await writeCollectionConfig(dir, [{
        name: 'projects',
        path: 'content/projects',
        template: 'project.html',
        route: 'work/{slug}',
      }])
      await writeFile(join(dir, 'src', 'templates', 'project.html'), '<ul>{#each services as service, i}<li data-i="{{i}}"><b>{{service.title}}</b><span>{{service.body}}</span></li>{/each}</ul>{{body}}')
      await writeFile(join(dir, 'content', 'projects', 'acme.md'), '---\ntitle: Acme\nservices:\n  - title: Strategy\n    body: Positioning\n  - title: Build\n    body: "<script>bad()</script>"\n---\nBody')

      const [route] = await compileContentFrom({ rootDir: dir, includeDrafts: false })

      expect(route.body).toContain('<li data-i="0"><b>Strategy</b><span>Positioning</span></li>')
      expect(route.body).toContain('<li data-i="1"><b>Build</b><span>&lt;script&gt;bad()&lt;/script&gt;</span></li>')
      expect(route.body).toContain('<p>Body</p>')
    })
  })

  test('renders content template else branches', async () => {
    await withProject(async (dir) => {
      await mkdir(join(dir, 'content', 'projects'), { recursive: true })
      await writeCollectionConfig(dir, [{
        name: 'projects',
        path: 'content/projects',
        template: 'project.html',
        route: 'work/{slug}',
      }])
      await writeFile(join(dir, 'src', 'templates', 'project.html'), '{#if image}<img src="{{image}}">{:else}<p>No image</p>{/if}{{body}}')
      await writeFile(join(dir, 'content', 'projects', 'acme.md'), '---\ntitle: Acme\n---\nBody')

      const [route] = await compileContentFrom({ rootDir: dir, includeDrafts: false })

      expect(route.body).toContain('<p>No image</p>')
      expect(route.body).not.toContain('<img')
    })
  })

  test('rejects content each blocks for non-array sources', async () => {
    await withProject(async (dir) => {
      await mkdir(join(dir, 'content', 'projects'), { recursive: true })
      await writeCollectionConfig(dir, [{
        name: 'projects',
        path: 'content/projects',
        template: 'project.html',
        route: 'work/{slug}',
      }])
      await writeFile(join(dir, 'src', 'templates', 'project.html'), '{#each title as item}<p>{{item}}</p>{/each}')
      await writeFile(join(dir, 'content', 'projects', 'acme.md'), '---\ntitle: Acme\n---\nBody')

      await expect(compileContentFrom({ rootDir: dir, includeDrafts: false })).rejects.toThrow('Component each source "title" is not an array')
    })
  })

  test('rejects malformed content each blocks', async () => {
    await withProject(async (dir) => {
      await mkdir(join(dir, 'content', 'projects'), { recursive: true })
      await writeCollectionConfig(dir, [{
        name: 'projects',
        path: 'content/projects',
        template: 'project.html',
        route: 'work/{slug}',
      }])
      await writeFile(join(dir, 'src', 'templates', 'project.html'), '{#each services}<p>Bad</p>{/each}')
      await writeFile(join(dir, 'content', 'projects', 'acme.md'), '---\ntitle: Acme\nservices: [One]\n---\nBody')

      await expect(compileContentFrom({ rootDir: dir, includeDrafts: false })).rejects.toThrow('Invalid component each')
    })
  })

  test('rejects malformed each sort clauses', async () => {
    await withProject(async (dir) => {
      await mkdir(join(dir, 'content', 'projects'), { recursive: true })
      await writeCollectionConfig(dir, [{
        name: 'projects',
        path: 'content/projects',
        template: 'project.html',
        route: 'work/{slug}',
      }])
      await writeFile(join(dir, 'src', 'templates', 'project.html'), '{#each services sort title sideways as service}<p>{{service.title}}</p>{/each}')
      await writeFile(join(dir, 'content', 'projects', 'acme.md'), '---\ntitle: Acme\nservices:\n  - title: Strategy\n---\nBody')

      await expect(compileContentFrom({ rootDir: dir, includeDrafts: false })).rejects.toThrow('Invalid component each sort')
    })
  })

  test('rejects unknown placeholder filters', async () => {
    await withProject(async (dir) => {
      await mkdir(join(dir, 'content', 'projects'), { recursive: true })
      await writeCollectionConfig(dir, [{
        name: 'projects',
        path: 'content/projects',
        template: 'project.html',
        route: 'work/{slug}',
      }])
      await writeFile(join(dir, 'src', 'templates', 'project.html'), '<p>{{title | upper}}</p>{{body}}')
      await writeFile(join(dir, 'content', 'projects', 'acme.md'), '---\ntitle: Acme\n---\nBody')

      await expect(compileContentFrom({ rootDir: dir, includeDrafts: false })).rejects.toThrow('Unknown component placeholder filter "upper"')
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

  test('lets collections.json declare posts with its own route and template', async () => {
    await withProject(async (dir) => {
      await mkdir(join(dir, 'content', 'posts'), { recursive: true })
      await writeCollectionConfig(dir, [{ name: 'posts', route: 'blog/{slug}', template: 'entry.html' }])
      await writeFile(join(dir, 'src', 'templates', 'entry.html'), '<h1>{{title}}</h1>{{tagsHtml}}{{body}}')
      await writeFile(join(dir, 'content', 'posts', 'hello.md'), '---\ntitle: Hello\ndate: 2026-05-26\ndescription: Post\ntags: [R&D]\n---\nBody')

      const [route] = await compileContentFrom({ rootDir: dir, includeDrafts: false })

      expect(route.collection).toBe('posts')
      expect(route.slug).toBe('blog/hello')
      expect(route.date).toBe('2026-05-26T00:00:00.000Z')
      expect(route.body).toContain('<a href="/tags/r-d/">R&amp;D</a>')
      expect(route.body).not.toContain('<Tag')
    })
  })

  test('still rejects posts without a date when declared in collections.json', async () => {
    await withProject(async (dir) => {
      await mkdir(join(dir, 'content', 'posts'), { recursive: true })
      await writeCollectionConfig(dir, [{ name: 'posts', route: 'blog/{slug}' }])
      await writeFile(join(dir, 'src', 'templates', 'post.html'), '<h1>{{title}}</h1>{{body}}')
      await writeFile(join(dir, 'content', 'posts', 'hello.md'), '---\ntitle: Hello\ndescription: Post\n---\nBody')

      await expect(compileContentFrom({ rootDir: dir })).rejects.toThrow('missing "date"')
    })
  })

  test('rejects custom collections using the reserved pages name', async () => {
    await withProject(async (dir) => {
      await writeCollectionConfig(dir, [{
        name: 'pages',
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

  test('rejects custom collections reusing reserved content paths', async () => {
    await withProject(async (dir) => {
      for (const path of ['content/posts', 'content/pages']) {
        await writeCollectionConfig(dir, [{
          name: 'projects',
          path,
          template: 'project.html',
          route: 'work/{slug}',
        }])

        await expect(compileContentFrom({ rootDir: dir })).rejects.toThrow('non-built-in content subfolder')
      }
    })
  })

  test('rejects duplicate generated content slugs across collections', async () => {
    await withProject(async (dir) => {
      await mkdir(join(dir, 'content', 'projects'), { recursive: true })
      await mkdir(join(dir, 'content', 'services'), { recursive: true })
      await writeCollectionConfig(dir, [{
        name: 'projects',
        path: 'content/projects',
        template: 'project.html',
        route: '{slug}',
      }, {
        name: 'services',
        path: 'content/services',
        template: 'service.html',
        route: '{slug}',
      }])
      await writeFile(join(dir, 'src', 'templates', 'project.html'), '<h1>{{title}}</h1>{{body}}')
      await writeFile(join(dir, 'src', 'templates', 'service.html'), '<h1>{{title}}</h1>{{body}}')
      await writeFile(join(dir, 'content', 'projects', 'about.md'), '---\ntitle: About project\n---\nProject')
      await writeFile(join(dir, 'content', 'services', 'about.md'), '---\ntitle: About service\n---\nService')

      await expect(compileContentFrom({ rootDir: dir })).rejects.toThrow('Duplicate content route slug "/about/"')
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
      await writeFile(join(dir, 'content', 'projects', 'acme.md'), '---\ntitle: Acme\nclient:\n---\nBody')

      try {
        await compileContentFrom({ rootDir: dir })
        throw new Error('expected missing required field BuildError')
      } catch (err) {
        expect(err).toBeInstanceOf(BuildError)
        const build = err as BuildError
        expect(build.message).toContain('missing "client"')
        expect(build.line).toBe(3)
        expect(build.hint).toContain('Add client: ...')
      }
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
