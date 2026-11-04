import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { build } from '../build/index'
import { createBuildContext } from '../build/build-context'
import { runChecks } from '../build/check'

async function fixture(run: (dir: string) => Promise<void>, siteUrl = 'https://example.com') {
  const dir = await mkdtemp(join(tmpdir(), 'sttc-discovery-consistency-'))
  const put = async (path: string, text: string) => {
    await mkdir(join(dir, path, '..'), { recursive: true })
    await writeFile(join(dir, path), text)
  }
  try {
    await put('src/site.json', JSON.stringify({ name: 'Discovery fixture', url: siteUrl, description: 'Useful pages.' }))
    await put('src/shell.html', '<!doctype html><html><head><script src="/router.js" type="module"></script></head><body><main></main></body></html>')
    await put('src/styles.css', 'body { margin: 0 }')
    await put('src/app.ts', 'export {}')
    await put('src/pages/index.html', '<head><SEO title="Home" description="Start here." /></head><h1>Home</h1><a href="/hidden/">Unlisted link allowed</a>')
    await put('src/pages/docs/guide.html', '<head><SEO title="Guide &amp; reference" description="Read &amp; learn." /></head><h1>Guide</h1><h2>Steps</h2><ul><li><a href="/">Home</a></li></ul><ol><li>First</li><li>Second</li></ol><pre><code>const x = 1\nconsole.log(x)</code></pre>')
    await put('src/pages/café.html', '<h1>Café</h1>')
    await put('src/templates/posts-index.html', '<h1>Insights</h1>')
    await put('src/pages/hidden.html', '<head><SEO title="Hidden" description="Reachable." unlisted /></head><h1>Hidden</h1>')
    await put('src/pages/404.html', '<h1>Not found</h1>')
    await put('src/templates/post.html', '<h1>{{title}}</h1>{{body}}')
    await put('content/posts/hello.md', '---\ntitle: Hello\ndescription: Published post.\ndate: 2026-05-01\ndateModified: 2026-05-03\n---\n## Story\n\nPublished text.')
    await put('content/posts/draft.md', '---\ntitle: Draft\ndescription: Not published.\ndate: 2026-05-01\ndraft: true\n---\nSecret draft.')
    await build({ context: createBuildContext({ rootDir: dir }), logger: { log() {}, warn() {} } })
    await run(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const check = (dir: string) => runChecks({ context: createBuildContext({ rootDir: dir }) })
async function alter(dir: string, file: string, change: (text: string) => string) {
  const path = join(dir, 'dist', file)
  await writeFile(path, change(await readFile(path, 'utf8')))
}

async function cli(dir: string, args: string[] = []) {
  const proc = Bun.spawn(['bun', join(import.meta.dir, '../build/check.ts'), '--skip-build', '--json', ...args], { cwd: dir, stdout: 'pipe', stderr: 'pipe' })
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const value: unknown = JSON.parse(stdout)
  expect(value).toMatchObject({ version: 1, command: 'check' })
  expect(stderr).toBe('')
  return { code: await proc.exited, value }
}

describe('built discovery consistency', () => {
  test('document metadata ignores accessible SVG titles in the shell', async () => {
    await fixture(async dir => {
      const shell = join(dir, 'src/shell.html')
      await writeFile(shell, (await readFile(shell, 'utf8')).replace('<body>', '<body><header><svg role="img"><title>Brand &amp; logo</title></svg></header>'))
      await build({ context: createBuildContext({ rootDir: dir }), logger: { log() {}, warn() {} } })
      expect((await check(dir)).errors).toEqual([])
      expect((await cli(dir)).code).toBe(0)
    })
  })

  test('root, nested, content, unlisted, draft and encoded paths have independent public expectations', async () => {
    await fixture(async dir => {
      expect((await check(dir)).errors).toEqual([])
      const manifest: unknown = JSON.parse(await readFile(join(dir, 'dist/site.manifest.json'), 'utf8'))
      expect(manifest).toHaveProperty('routes.length', 5)
      expect(manifest).toMatchObject({ routes: expect.arrayContaining([
        expect.objectContaining({ slug: 'index', canonical: 'https://example.com/', representations: { html: '/', markdown: '/index.md', metadata: '/routes/index.json' } }),
        expect.objectContaining({ slug: 'docs/guide', title: 'Guide & reference', description: 'Read & learn.', canonical: 'https://example.com/docs/guide/' }),
        expect.objectContaining({ slug: 'café', canonical: 'https://example.com/caf%C3%A9/' }),
        expect.objectContaining({ slug: 'insights/hello', lastModified: '2026-05-03T00:00:00.000Z' }),
      ]) })
      const sitemap = await readFile(join(dir, 'dist/sitemap.xml'), 'utf8')
      expect([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]).sort()).toEqual([
        'https://example.com/', 'https://example.com/caf%C3%A9/', 'https://example.com/docs/guide/', 'https://example.com/insights/', 'https://example.com/insights/hello/',
      ])
      expect(await Bun.file(join(dir, 'dist/insights/draft/index.html')).exists()).toBe(false)
      const markdown = await readFile(join(dir, 'dist/docs/guide/index.md'), 'utf8')
      for (const expected of ['# Guide', '## Steps', '- [Home](/)', '1. First\n2. Second', '```\nconst x = 1\nconsole.log(x)\n```']) expect(markdown).toContain(expected)
      expect(markdown).toBe(await readFile(join(dir, 'dist/routes/docs/guide.md'), 'utf8'))
      expect((await cli(dir)).code).toBe(0)
    })
  })

  test('accepts formatting, attribute order, inventory order and trailing-slash site origin', async () => {
    await fixture(async dir => {
      await alter(dir, 'docs/guide/index.html', text => text.replace('<link rel="canonical" href="https://example.com/docs/guide/">', "<link href='https://example.com/docs/guide/' rel='canonical' >").replace('Guide &amp; reference</title>', ' Guide &#38;   reference </title>'))
      await alter(dir, 'sitemap.xml', text => text.replace(/<url>(.*?)<\/url>/g, '<url>\n $1 \n</url>').replace(/(<loc>.*?<\/loc>)(<lastmod>.*?<\/lastmod>)/, '$2$1'))
      await alter(dir, 'routes/insights/hello.json', text => text.replaceAll('2026-05-03T00:00:00.000Z', '2026-05-03T02:00:00+02:00'))
      await alter(dir, 'site.manifest.json', text => {
        const value: unknown = JSON.parse(text)
        if (typeof value !== 'object' || value === null || !('routes' in value) || !Array.isArray(value.routes)) throw new Error('fixture manifest invalid')
        value.routes.reverse()
        return JSON.stringify(value)
      })
      expect((await check(dir)).errors).toEqual([])
    }, 'https://example.com/')
  })

  const corruptions: Array<{ name: string; file: string; change: (text: string) => string; error: string }> = [
    { name: 'document title', file: 'index.html', change: text => text.replace('Home</title>', 'Wrong document</title>'), error: 'route / manifest title disagrees with HTML' },
    { name: 'canonical', file: 'docs/guide/index.html', change: text => text.replace('rel="canonical" href="https://example.com/docs/guide/"', 'rel="canonical" href="https://example.com/"'), error: 'route /docs/guide/ canonical' },
    { name: 'missing sitemap member', file: 'sitemap.xml', change: text => text.replace(/<url><loc>https:\/\/example.com\/docs\/guide\/<\/loc><\/url>/, ''), error: 'route /docs/guide/ must appear exactly once in sitemap' },
    { name: 'unlisted inventory entry', file: 'site.manifest.json', change: text => text.replaceAll('docs/guide', 'hidden'), error: 'route /hidden/ is not a public built page' },
    { name: 'unlisted sitemap entry', file: 'sitemap.xml', change: text => text.replace('</urlset>', '<url><loc>https://example.com/hidden/</loc></url></urlset>'), error: 'route https://example.com/hidden/ is not a public built page' },
    { name: 'HTML route marker', file: 'docs/guide/index.html', change: text => text.replace('data-snz-route="docs/guide"', 'data-snz-route="index"'), error: 'route /docs/guide/ HTML route identity' },
    { name: 'wrong existing metadata target', file: 'site.manifest.json', change: text => text.replace('/routes/docs/guide.json', '/routes/index.json'), error: 'route /docs/guide/ manifest metadata representation' },
    { name: 'wrong existing Markdown target', file: 'docs/guide/index.html', change: text => text.replace('/docs/guide/index.md', '/index.md'), error: 'route /docs/guide/ HTML Markdown target' },
    { name: 'wrong metadata identity', file: 'routes/docs/guide.json', change: text => text.replaceAll('docs/guide', 'index'), error: 'route /docs/guide/ metadata identity' },
    { name: 'shared title', file: 'routes/docs/guide.json', change: text => text.replace('Guide & reference', 'Wrong title'), error: 'route /docs/guide/ metadata title' },
    { name: 'shared description', file: 'routes/docs/guide.json', change: text => text.replace('Read & learn.', 'Wrong description'), error: 'route /docs/guide/ metadata description' },
    { name: 'shared date', file: 'routes/insights/hello.json', change: text => text.replaceAll('2026-05-03', '2026-05-04'), error: 'route /insights/hello/ metadata lastModified' },
    { name: 'sitemap date', file: 'sitemap.xml', change: text => text.replaceAll('2026-05-03', '2026-05-04'), error: 'route /insights/hello/ sitemap lastmod' },
    { name: 'HTML date', file: 'insights/hello/index.html', change: text => text.replaceAll('2026-05-03', '2026-05-04'), error: 'route /insights/hello/ HTML modified date' },
    { name: 'alias content', file: 'docs/guide/index.md', change: text => text.replace('# Guide', '# Wrong'), error: 'route /docs/guide/ same-path Markdown alias' },
    { name: 'malformed JSON boundary', file: 'routes/docs/guide.json', change: () => 'null', error: 'routes/docs/guide.json: invalid JSON object' },
    { name: 'malformed representation boundary', file: 'routes/docs/guide.json', change: text => text.replace('"/docs/guide/index.md"', '42'), error: 'route docs/guide metadata or representations incomplete' },
  ]
  for (const corruption of corruptions) {
    test(`rejects ${corruption.name} via API and skip-build JSON, even with allow-broken-links`, async () => {
      await fixture(async dir => {
        await alter(dir, corruption.file, corruption.change)
        expect((await check(dir)).errors.some(error => error.includes(corruption.error))).toBe(true)
        const result = await cli(dir, ['--allow-broken-links'])
        expect(result.code).toBe(1)
        expect(result.value).toMatchObject({ outcome: "failure", errors: expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining(corruption.error) })]) })
      })
    })
  }
})
