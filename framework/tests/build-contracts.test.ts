import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { createComposer } from '../build/compose'
import { outFileFromSlug, slugFromPageRel } from '../build/source-files'
import { slugifyTag } from '../build/content'
import { BuildError } from '../build/errors'
import { mediaInputCopyExclusions, shouldSkipMediaCopy } from '../build/assets'
import { assertUniqueImageNames, imageSourceRoots, parsePagesCmsMediaInputs, parsePagesCmsMediaOutputs, resolveImageAttrs } from '../build/images'
import { publicPathFromSlug, slugFromPath } from '../runtime/lib/paths.js'
import { checkBuiltImageRefs, checkPagesCmsConfig, checkVercelConfig, extractBuiltImageRefs, extractBuiltPublicAssetRefs } from '../build/check'
import { selectAppEntry, sourceRuntimeLibDir } from '../build/paths'

async function composeRoute(slug: string, fileHint: string) {
  const seoTemplate = await readFile('src/components/SEO.html', 'utf8')
  const composer = createComposer(new Map([['SEO', seoTemplate]]), new Map(), () => ({}))
  return composer.prepareRouteSource('<h1>Page</h1>', { slug, fileHint })
}

async function tempProject() {
  return mkdtemp(join(tmpdir(), 'snz-bp-media-'))
}

describe('build path contracts', () => {
  test('normalizes nested page files to route slugs', () => {
    expect(slugFromPageRel('index.html')).toBe('index')
    expect(slugFromPageRel('about.html')).toBe('about')
    expect(slugFromPageRel('blog/index.html')).toBe('blog')
    expect(slugFromPageRel('work/case.html')).toBe('work/case')
  })

  test('keeps output route file contract under dist/routes', () => {
    expect(outFileFromSlug('index')).toBe('index.html')
    expect(outFileFromSlug('blog')).toBe('blog.html')
    expect(outFileFromSlug('work/case')).toBe('work/case.html')
  })

  test('keeps public path and router slug contract aligned', () => {
    expect(publicPathFromSlug('index')).toBe('/')
    expect(publicPathFromSlug('blog')).toBe('/blog/')
    expect(publicPathFromSlug('work/case')).toBe('/work/case/')
    expect(slugFromPath('/')).toBe('index')
    expect(slugFromPath('/work/case/')).toBe('work/case')
  })

  test('slugifies generated tag routes predictably', () => {
    expect(slugifyTag('Bun Native')).toBe('bun-native')
    expect(slugifyTag('Ångström & SEO')).toBe('angstrom-seo')
  })

  test('prefers TypeScript app entry and rejects ambiguous root entries', () => {
    const paths = { appTs: '/site/src/app.ts', appJs: '/site/src/app.js', legacyAppJs: '/site/src/app/app.js' }
    expect(selectAppEntry(paths, new Set([paths.appTs]))).toBe(paths.appTs)
    expect(selectAppEntry(paths, new Set([paths.appJs]))).toBe(paths.appJs)
    expect(selectAppEntry(paths, new Set([paths.legacyAppJs]))).toBe(paths.legacyAppJs)
    expect(() => selectAppEntry(paths, new Set([paths.appTs, paths.appJs]))).toThrow(BuildError)
  })

  test('parses PagesCMS media inputs and outputs from .pages.yml', () => {
    const yaml = `
media:
  - name: images
    input: src/images
    output: /assets/images
  - name: portraits
    input: uploads/portraits # editor uploads
    output: "/assets/portraits" # wrong on purpose
content:
  - name: posts
    path: content/posts
`

    expect(parsePagesCmsMediaInputs(yaml)).toEqual(['src/images', 'uploads/portraits'])
    expect(parsePagesCmsMediaOutputs(yaml)).toEqual(['/assets/images', '/assets/portraits'])
  })

  test('resolves framework runtime lib directory after internals move', async () => {
    const libDir = await sourceRuntimeLibDir()

    expect(libDir).toContain('framework/runtime/lib')
    expect(await Bun.file(`${libDir}/paths.js`).exists()).toBe(true)
  })

  test('accepts canonical Vercel static deploy config', async () => {
    const dir = await tempProject()
    try {
      await writeFile(join(dir, 'vercel.json'), JSON.stringify({
        framework: null,
        installCommand: 'bun install',
        buildCommand: 'bun run build',
        devCommand: 'bun run dev',
        outputDirectory: 'dist',
        bunVersion: '1.x',
        cleanUrls: true,
        trailingSlash: true,
        headers: [
          { source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
          { source: '/(llms|llms-full|robots|sitemap).(txt|xml)', headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }] },
        ],
      }))
      const warnings: string[] = []

      await checkVercelConfig(dir, (warning) => warnings.push(warning))

      expect(warnings).toEqual([])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('keeps root and starter Vercel config in parity', async () => {
    const rootConfig = JSON.parse(await readFile('vercel.json', 'utf8'))
    const starterConfig = JSON.parse(await readFile('templates/default/vercel.json', 'utf8'))
    const keys = ['framework', 'installCommand', 'buildCommand', 'devCommand', 'outputDirectory', 'bunVersion', 'cleanUrls', 'trailingSlash', 'headers']

    for (const key of keys) {
      expect(starterConfig[key]).toEqual(rootConfig[key])
    }
  })

  test('warns on Vercel deploy config drift', async () => {
    const dir = await tempProject()
    try {
      await writeFile(join(dir, 'vercel.json'), JSON.stringify({
        installCommand: 'npm install',
        buildCommand: 'npm run build',
        outputDirectory: 'public',
        headers: [],
      }))
      const warnings: string[] = []

      await checkVercelConfig(dir, (warning) => warnings.push(warning))

      expect(warnings).toContain('vercel.json: framework should be null for snz-bp Bun static deploys')
      expect(warnings).toContain('vercel.json: installCommand should be "bun install" for snz-bp Bun static deploys')
      expect(warnings).toContain('vercel.json: buildCommand should be "bun run build" for snz-bp Bun static deploys')
      expect(warnings).toContain('vercel.json: devCommand should be "bun run dev" for snz-bp Bun static deploys')
      expect(warnings).toContain('vercel.json: outputDirectory should be "dist" for snz-bp Bun static deploys')
      expect(warnings).toContain('vercel.json: bunVersion should be "1.x" for snz-bp Bun static deploys')
      expect(warnings).toContain('vercel.json: cleanUrls should be true for snz-bp Bun static deploys')
      expect(warnings).toContain('vercel.json: trailingSlash should be true for snz-bp Bun static deploys')
      expect(warnings).toContain('vercel.json: /assets/(.*) should use immutable Cache-Control headers')
      expect(warnings).toContain('vercel.json: discovery files should use short Cache-Control headers')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('warns on PagesCMS media output drift', () => {
    const warnings: string[] = []

    checkPagesCmsConfig(`media:\n  - name: images\n    input: src/images\n    output: /src/images\n`, (warning) => warnings.push(warning))

    expect(warnings).toContain('.pages.yml: media.output "/src/images" should be /assets/images because CMS images publish as optimized assets')
  })

  test('extracts built image refs from HTML attrs, meta content, srcset, and JSON', () => {
    const refs = extractBuiltImageRefs(`<img src="/assets/images/hero.webp">
<meta property="og:image" content="/assets/images/og.webp">
<video poster="/assets/images/poster.webp"></video>
<img srcset="/assets/images/hero-320.webp 320w, /assets/images/hero-640.webp 640w">
{"image":"/assets/images/team.webp","template":"/assets/images/{src}.webp"}`)

    expect(refs).toEqual([
      '/assets/images/hero-320.webp',
      '/assets/images/hero-640.webp',
      '/assets/images/hero.webp',
      '/assets/images/og.webp',
      '/assets/images/poster.webp',
      '/assets/images/team.webp',
    ])
  })

  test('extracts built public asset refs for images, videos, and files', () => {
    const refs = extractBuiltPublicAssetRefs(`<img src="/assets/images/hero.webp">
<video src="/assets/videos/intro.mp4" poster="/assets/images/poster.webp"></video>
<a href="/assets/files/menu.pdf">Menu</a>
{"template":"/assets/files/{slug}.pdf"}`)

    expect(refs).toEqual([
      '/assets/files/menu.pdf',
      '/assets/images/hero.webp',
      '/assets/images/poster.webp',
      '/assets/videos/intro.mp4',
    ])
  })

  test('fails missing built image refs after CMS media normalization', async () => {
    const dir = await tempProject()
    try {
      await mkdir(join(dir, 'assets', 'images'), { recursive: true })
      await mkdir(join(dir, 'routes'), { recursive: true })
      await writeFile(join(dir, 'index.html'), '<meta property="og:image" content="/assets/images/og.webp"><img src="/assets/images/hero.webp">')
      await writeFile(join(dir, 'assets', 'images', 'og.webp'), 'ok')
      await writeFile(join(dir, 'assets', 'images', 'hero.webp'), 'ok')
      await writeFile(join(dir, 'routes', 'team.json'), JSON.stringify({ image: '/assets/images/team.webp' }))
      await writeFile(join(dir, 'routes', 'media.html'), '<video src="/assets/videos/intro.mp4"></video><a href="/assets/files/menu.pdf">Menu</a>')
      const errors: string[] = []

      await checkBuiltImageRefs(dir, (error) => errors.push(error))

      expect(errors).toHaveLength(3)
      const joined = errors.join('\n')
      expect(joined).toContain('missing public asset /assets/images/team.webp')
      expect(joined).toContain('PagesCMS media.input')
      expect(joined).toContain('CMS /src/images/* refs publish as /assets/images/*.webp')
      expect(joined).toContain('missing public asset /assets/files/menu.pdf')
      expect(joined).toContain('src/files')
      expect(joined).toContain('missing public asset /assets/videos/intro.mp4')
      expect(joined).toContain('src/videos')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('uses PagesCMS media.input as image source root', async () => {
    const dir = await tempProject()
    try {
      await writeFile(join(dir, '.pages.yml'), `media:\n  - name: images\n    input: uploads/images\n    output: /assets/images\n`)
      const roots = await imageSourceRoots(dir)

      expect(roots.map((root) => root.label)).toContain('uploads/images')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('rejects unsafe PagesCMS media.input paths', async () => {
    const dir = await tempProject()
    try {
      await writeFile(join(dir, '.pages.yml'), `media:\n  - name: images\n    input: ../outside\n    output: /assets/images\n`)

      await expect(imageSourceRoots(dir)).rejects.toThrow('Invalid PagesCMS media.input "../outside"')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('excludes media.input roots under media from raw media copy', async () => {
    const dir = await tempProject()
    try {
      await writeFile(join(dir, '.pages.yml'), `media:\n  - name: images\n    input: media/photos\n    output: /assets/images\n  - name: portraits\n    input: uploads/portraits\n    output: /assets/images\n`)
      const exclusions = await mediaInputCopyExclusions(dir)

      expect(exclusions).toEqual(['photos'])
      expect(shouldSkipMediaCopy('photos/team.png', exclusions)).toBe(true)
      expect(shouldSkipMediaCopy('photos/nested/team.png', exclusions)).toBe(true)
      expect(shouldSkipMediaCopy('downloads/file.pdf', exclusions)).toBe(false)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('allows unique logical image names across source roots', async () => {
    const dir = await tempProject()
    try {
      await mkdir(join(dir, 'src/images'), { recursive: true })
      await mkdir(join(dir, 'src/images'), { recursive: true })
      await writeFile(join(dir, 'src/images/hero.png'), 'src')
      await writeFile(join(dir, 'src/images/team.webp'), 'media')

      await expect(assertUniqueImageNames(...(await imageSourceRoots(dir)))).resolves.toBeUndefined()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('rejects duplicate logical image names across source roots', async () => {
    const dir = await tempProject()
    try {
      await mkdir(join(dir, 'src/images'), { recursive: true })
      await mkdir(join(dir, 'src/images'), { recursive: true })
      await writeFile(join(dir, 'src/images/hero.png'), 'src')
      await writeFile(join(dir, 'src/images/hero.webp'), 'media')

      try {
        await assertUniqueImageNames(...(await imageSourceRoots(dir)))
        throw new Error('expected duplicate image BuildError')
      } catch (err) {
        expect(err).toBeInstanceOf(BuildError)
        const build = err as BuildError
        expect(build.message).toContain('Duplicate image logical names found')
        expect(build.message).toContain('src/images/hero.png')
        expect(build.message).toContain('src/images/hero.webp')
        expect(build.hint).toContain('Keep each basename unique')
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('keeps eager Image output as plain main image', () => {
    const attrs = resolveImageAttrs({ hero: { width: 1200, height: 800, sizes: [320, 640] } }, {
      src: 'hero',
      alt: 'Hero',
      loading: 'eager',
    })

    expect(attrs.imgTmp).toBe('')
    expect(attrs.imgMain).not.toContain('class=')
    expect(attrs.imgMain).toContain('fetchpriority="high"')
  })

  test('keeps lazy Image tmp separate from plain main image', () => {
    const attrs = resolveImageAttrs({ hero: { width: 1200, height: 800, placeholder: 'data:image/png;base64,x' } }, {
      src: 'hero',
      alt: 'Hero',
    })

    expect(attrs.imgTmp).toContain('class="img-tmp"')
    expect(attrs.imgMain).not.toContain('class=')
    expect(attrs.imgMain).toContain('loading="lazy"')
  })

  test('uses explicit route slug for default SEO instead of source file path', async () => {
    const html = await composeRoute('about', 'src/pages/about.html')

    expect(html).toContain('<link rel="canonical" href="https://example.com/about/">')
    expect(html).toContain('<meta property="og:url" content="https://example.com/about/">')
    expect(html).toContain('"url":"https://example.com/about/"')
    expect(html).not.toContain('/src/pages/about/')
  })

  test('keeps index route canonical at site root', async () => {
    const html = await composeRoute('index', 'src/pages/index.html')

    expect(html).toContain('<link rel="canonical" href="https://example.com/">')
    expect(html).toContain('<meta property="og:url" content="https://example.com/">')
    expect(html).not.toContain('/index/')
  })
})
