import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { compileContentFrom } from '../build/content'
import { BuildError } from '../build/errors'
import { ensureHeadingIds } from '../build/heading-ids'
import { parseFrontMatter, render, slugify } from '../build/markdown'
import { checkBuiltOutput } from '../build/check'

async function withProject(fn: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'snz-content-correctness-'))
  try {
    await mkdir(join(dir, 'src', 'templates'), { recursive: true })
    await mkdir(join(dir, 'content', 'posts'), { recursive: true })
    await writeFile(join(dir, 'src', 'templates', 'post.html'), '{{body}}')
    await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function writePost(dir: string, name: string, source: string) {
  await writeFile(join(dir, 'content', 'posts', name), source)
}

async function captureError(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (error instanceof BuildError) return error
    throw error
  }
  throw new Error('expected a BuildError')
}

describe('unicode-safe slugs', () => {
  test('transliterates letters NFKD cannot decompose', () => {
    expect(slugify('Ærø')).toBe('aero')
    expect(slugify('Fødselsdag')).toBe('fodselsdag')
    expect(slugify('Søren Kierkegaard')).toBe('soren-kierkegaard')
    expect(slugify('Straße')).toBe('strasse')
  })

  test('folds å through NFKD to a', () => {
    expect(slugify('Åben')).toBe('aben')
  })

  test('tag routes and heading ids use the same slug', async () => {
    await withProject(async (dir) => {
      await writeFile(join(dir, 'src', 'templates', 'post.html'), '{{tagsHtml}}{{body}}')
      await writePost(dir, 'tagged.md', '---\ntitle: Tagged\ndate: 2026-05-26\ndescription: Tagged post\ntags: [Ærø, Fødselsdag]\n---\n## Søren Kierkegaard\n')

      const [route] = await compileContentFrom({ rootDir: dir })
      expect(route?.body).toContain('href="/tags/aero/"')
      expect(route?.body).toContain('href="/tags/fodselsdag/"')
      expect(render('## Søren Kierkegaard')).toContain('id="soren-kierkegaard"')
      expect(ensureHeadingIds('<h2>Ærø</h2>', 'src/pages/index.html')).toBe('<h2 id="aero">Ærø</h2>')
    })
  })
})

describe('malformed front matter', () => {
  test('unclosed quoted value names the file and the line', async () => {
    await withProject(async (dir) => {
      await writePost(dir, 'bad.md', '---\ntitle: "Unclosed\ndate: 2026-05-26\n---\nBody')
      const error = await captureError(compileContentFrom({ rootDir: dir }))
      expect(error.message).toContain('Invalid front-matter YAML')
      expect(error.file).toBe('content/posts/bad.md')
      expect(error.line).toBe(2)
    })
  })

  test('unclosed flow sequence names the file and the line', async () => {
    await withProject(async (dir) => {
      await writePost(dir, 'bad.md', '---\ntitle: Ok\ntags: [a, b\ndate: 2026-05-26\n---\nBody')
      const error = await captureError(compileContentFrom({ rootDir: dir }))
      expect(error.file).toBe('content/posts/bad.md')
      expect(error.line).toBe(3)
    })
  })

  test('mis-indented block names the file and the line', async () => {
    await withProject(async (dir) => {
      await writePost(dir, 'bad.md', '---\ntitle: Ok\n  nested: value\ndate: 2026-05-26\n---\nBody')
      const error = await captureError(compileContentFrom({ rootDir: dir }))
      expect(error.file).toBe('content/posts/bad.md')
      expect(error.line).toBe(3)
    })
  })

  test('parser without a file still throws', () => {
    expect(() => parseFrontMatter('---\ntitle: "x\n---\n')).toThrow(BuildError)
  })
})

describe('front-matter slug override', () => {
  test('replaces the filename slug in the route and in template basename', async () => {
    await withProject(async (dir) => {
      await writeFile(join(dir, 'src', 'templates', 'post.html'), '<p>{{basename}}</p>{{body}}')
      await writePost(dir, 'My Long Draft.md', '---\ntitle: Hi\ndate: 2026-05-26\ndescription: Hi\nslug: short-name\n---\nBody')

      const [route] = await compileContentFrom({ rootDir: dir })
      expect(route?.slug).toBe('insights/short-name')
      expect(route?.routeFile).toBe('insights/short-name.html')
      expect(route?.body).toContain('<p>short-name</p>')
    })
  })

  test('rejects unsafe override values', async () => {
    await withProject(async (dir) => {
      await writeFile(join(dir, 'src', 'templates', 'post.html'), '{{body}}')
      await writePost(dir, 'ok.md', '---\ntitle: Hi\ndate: 2026-05-26\ndescription: Hi\nslug: "../escape"\n---\nBody')
      const error = await captureError(compileContentFrom({ rootDir: dir }))
      expect(error.message).toContain('Unsafe front-matter slug "../escape"')
      expect(error.file).toBe('content/posts/ok.md')
      expect(error.line).toBe(5)
    })
  })

  test('colliding overrides fail on the duplicate route', async () => {
    await withProject(async (dir) => {
      await writeFile(join(dir, 'src', 'templates', 'post.html'), '{{body}}')
      await writePost(dir, 'a.md', '---\ntitle: A\ndate: 2026-05-26\ndescription: A\nslug: same\n---\nA')
      await writePost(dir, 'b.md', '---\ntitle: B\ndate: 2026-05-26\ndescription: B\nslug: same\n---\nB')
      await expect(compileContentFrom({ rootDir: dir })).rejects.toThrow(/duplicate/i)
    })
  })
})

describe('media references with spaces', () => {
  test('front-matter image with a %20 file name publishes the encoded webp path', async () => {
    await withProject(async (dir) => {
      await writeFile(join(dir, 'src', 'templates', 'post.html'), '<img src="{{image}}" alt="">{{body}}')
      await writePost(dir, 'photo.md', '---\ntitle: Hi\ndate: 2026-05-26\ndescription: Hi\nimage: /src/images/my%20photo.png\n---\nBody')

      const [route] = await compileContentFrom({ rootDir: dir })
      expect(route?.body).toContain('src="/assets/images/my%20photo.webp"')
    })
  })

  test('built output with a %20 link to a file with a space resolves', async () => {
    await withProject(async (dir) => {
      const out = join(dir, 'dist')
      await mkdir(join(out, 'assets', 'files'), { recursive: true })
      await mkdir(join(out, 'media'), { recursive: true })
      const ld = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage"}</script>'
      await writeFile(join(out, 'assets', 'files', 'my doc.pdf'), 'pdf')
      await writeFile(join(out, 'media', 'index.html'), `${ld}<a href="/assets/files/my%20doc.pdf">Menu</a>`)
      await writeFile(join(out, '404.html'), ld)
      const errors: string[] = []

      await checkBuiltOutput(out, (error) => errors.push(error), false)

      expect(errors).toEqual([])
    })
  })
})

describe('collection records without a description', () => {
  test('a missing description renders an empty value, not a placeholder', async () => {
    await withProject(async (dir) => {
      await mkdir(join(dir, 'content', 'projects'), { recursive: true })
      await writeFile(join(dir, 'content', 'collections.json'), JSON.stringify({
        collections: [{ name: 'projects', path: 'content/projects', template: 'project.html', route: 'work/{slug}' }],
      }))
      await writeFile(join(dir, 'src', 'templates', 'project.html'), '<meta name="description" content="{{description}}">{{body}}')
      await writeFile(join(dir, 'content', 'projects', 'acme.md'), '---\ntitle: Acme\n---\nBody')

      const routes = await compileContentFrom({ rootDir: dir })
      const project = routes.find((route) => route.collection === 'projects')
      expect(project?.body).toContain('content=""')
      expect(project?.body).not.toContain('{{description}}')
    })
  })
})
