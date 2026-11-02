import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { createComposer } from '../build/compose'
import { buildYear, outFileFromSlug, slugFromPageRel, sourceDateEpoch } from '../build/source-files'
import { slugifyTag } from '../build/content'
import { BuildError } from '../build/errors'
import { assertUniqueImageNames, imageSourceRoots, parsePagesCmsMediaInputs, parsePagesCmsMediaOutputs, processImages, resolveImageAttrs } from '../build/images'
import { imageNameFromSrc, parsePositiveImageInteger } from '../build/scan-images'
import { publicMarkdownPathFromSlug, publicPathFromSlug, routeJsonPathFromSlug, routeMarkdownPathFromSlug, slugFromPath } from '../runtime/lib/paths.js'
import { checkBuiltOutput, checkPagesCmsConfig, checkVercelConfig, extractBuiltPublicAssetRefs } from '../build/check'
import { selectAppEntry } from '../build/paths'

async function composeRoute(slug: string, fileHint: string) {
  const composer = createComposer(new Map(), new Map(), () => ({}))
  return composer.prepareRouteSource('<h1>Page</h1>', { slug, fileHint })
}

async function tempProject() {
  return mkdtemp(join(tmpdir(), 'sttc-media-'))
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
    expect(publicMarkdownPathFromSlug('index')).toBe('/index.md')
    expect(publicMarkdownPathFromSlug('about')).toBe('/about/index.md')
    expect(publicMarkdownPathFromSlug('work/case')).toBe('/work/case/index.md')
    expect(routeMarkdownPathFromSlug('index')).toBe('/routes/index.md')
    expect(routeMarkdownPathFromSlug('work/case')).toBe('/routes/work/case.md')
    expect(routeJsonPathFromSlug('about')).toBe('/routes/about.json')
  })

  test('supports reproducible timestamps through SOURCE_DATE_EPOCH', () => {
    expect(sourceDateEpoch('0')?.toISOString()).toBe('1970-01-01T00:00:00.000Z')
    expect(buildYear('1767225600')).toBe('2026')
    expect(() => sourceDateEpoch('-1')).toThrow('non-negative integer')
    expect(() => sourceDateEpoch('tomorrow')).toThrow('non-negative integer')
  })

  test('shell currentYear honors SOURCE_DATE_EPOCH', async () => {
    const dir = await tempProject()
    const previous = process.env.SOURCE_DATE_EPOCH
    try {
      await mkdir(join(dir, 'src'), { recursive: true })
      await writeFile(join(dir, 'src', 'site.json'), JSON.stringify({
        name: 'Year Site',
        url: 'https://example.com',
        description: 'Year fixture',
        locale: 'en',
      }))
      process.env.SOURCE_DATE_EPOCH = '0'
      const composer = createComposer(new Map(), new Map(), () => ({}), undefined, undefined, new Map(), {
        siteFile: join(dir, 'src', 'site.json'),
      })
      const html = await composer.prepareShellSource('<footer>{{currentYear}}</footer>')
      expect(html).toContain('1970')
    } finally {
      if (previous === undefined) delete process.env.SOURCE_DATE_EPOCH
      else process.env.SOURCE_DATE_EPOCH = previous
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('validates Image logical names and integer attrs strictly', () => {
    expect(imageNameFromSrc('hero.v2')).toBe('hero.v2')
    expect(() => imageNameFromSrc('hero.jpg')).toThrow('without a path or extension')
    expect(() => imageNameFromSrc('../hero')).toThrow('without a path or extension')
    expect(() => imageNameFromSrc('team photo')).toThrow('without a path or extension')
    expect(parsePositiveImageInteger('1200', 'max')).toBe(1200)
    expect(() => parsePositiveImageInteger('1200px', 'max')).toThrow('positive integer')
    expect(() => parsePositiveImageInteger('0', 'quality')).toThrow('positive integer')
    expect(() => resolveImageAttrs({ hero: { width: 1200, height: 800 } }, {
      src: 'hero', alt: 'Hero', quality: '101',
    })).toThrow('quality must be 1–100')
  })

  test('rejects invalid Image output dimensions before rendering', () => {
    const meta = { hero: { width: 1200, height: 800 } }
    expect(() => resolveImageAttrs(meta, { src: 'hero.png', alt: 'Hero' })).toThrow('without a path or extension')
    expect(() => resolveImageAttrs(meta, { src: 'hero', alt: 'Hero', width: '12px' })).toThrow('positive integer')
  })

  test('prunes optional unresolved placeholders from component attributes', async () => {
    const boxTemplate = '<section id="{{id}}" data-theme="{{theme}}" class="c {{center}}" style="--x: {{x}}; color: red">{{slot}}</section>'
    const composer = createComposer(new Map([['Box', boxTemplate]]), new Map(), () => ({}))

    const html = await composer.prepareRouteSource('<Box><p>Hi</p></Box>', { slug: 'index', fileHint: 'test.html' })

    expect(html).toContain('<section class="c" style="color: red"><p>Hi</p></section>')
    expect(html).not.toContain('{{theme}}')
    expect(html).not.toContain('data-theme')
  })

  test('slugifies generated tag routes predictably', () => {
    expect(slugifyTag('Bun Native')).toBe('bun-native')
    expect(slugifyTag('Ångström & SEO')).toBe('angstrom-seo')
  })

  test('prefers TypeScript app entry and rejects ambiguous root entries', () => {
    const paths = { appTs: '/site/src/app.ts', appJs: '/site/src/app.js' }
    expect(selectAppEntry(paths, new Set([paths.appTs]))).toBe(paths.appTs)
    expect(selectAppEntry(paths, new Set([paths.appJs]))).toBe(paths.appJs)
    expect(selectAppEntry(paths, new Set())).toBe(paths.appTs)
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
          { source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }] },
          { source: '/assets/(css|js)/(.*)\\.([a-f0-9]{8,})\\.(css|js|woff2?)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
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

  test('warns when an immutable Cache-Control rule is not limited to hashed assets', async () => {
    const dir = await tempProject()
    const immutable = (source: string) => ({ source, headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] })
    const warning = (source: string) => `vercel.json: immutable Cache-Control on "${source}" is not limited to hashed assets; replaced media would stay cached. Match the hash group, e.g. /assets/(css|js)/(.*)\\.([a-f0-9]{8,})\\.(css|js|woff2?)`
    try {
      const shipped = JSON.parse(await readFile('vercel.json', 'utf8'))
      await writeFile(join(dir, 'vercel.json'), JSON.stringify({
        ...shipped,
        headers: [...shipped.headers, immutable('/assets/(.*)'), immutable('/assets/js/vendor/(.*)'), immutable('/assets/:path+')],
      }))
      const warnings: string[] = []

      await checkVercelConfig(dir, (warning) => warnings.push(warning))

      expect(warnings).toEqual([warning('/assets/(.*)'), warning('/assets/js/vendor/(.*)'), warning('/assets/:path+')])
    } finally {
      await rm(dir, { recursive: true, force: true })
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

      expect(warnings).toContain('vercel.json: framework should be null for sttc Bun static deploys')
      expect(warnings).toContain('vercel.json: installCommand should be "bun install" for sttc Bun static deploys')
      expect(warnings).toContain('vercel.json: buildCommand should be "bun run build" for sttc Bun static deploys')
      expect(warnings).toContain('vercel.json: devCommand should be "bun run dev" for sttc Bun static deploys')
      expect(warnings).toContain('vercel.json: outputDirectory should be "dist" for sttc Bun static deploys')
      expect(warnings).toContain('vercel.json: bunVersion should be "1.x" for sttc Bun static deploys')
      expect(warnings).toContain('vercel.json: cleanUrls should be true for sttc Bun static deploys')
      expect(warnings).toContain('vercel.json: trailingSlash should be true for sttc Bun static deploys')
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
    const refs = extractBuiltPublicAssetRefs(`<img src="/assets/images/hero.webp">
<meta property="og:image" content="/assets/images/og.webp">
<video poster="/assets/images/poster.webp"></video>
<img srcset="/assets/images/hero-320.webp 320w, /assets/images/hero-640.webp 640w">
{"image":"/assets/images/team.webp","template":"/assets/images/{src}.webp"}`)
      .filter((ref) => ref.startsWith('/assets/images/'))

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
      await mkdir(join(dir, 'media'), { recursive: true })
      const ld = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage"}</script>'
      await writeFile(join(dir, 'index.html'), `${ld}<meta property="og:image" content="/assets/images/og.webp"><img src="/assets/images/hero.webp">`)
      await writeFile(join(dir, 'assets', 'images', 'og.webp'), 'ok')
      await writeFile(join(dir, 'assets', 'images', 'hero.webp'), 'ok')
      await writeFile(join(dir, 'routes', 'team.json'), JSON.stringify({ image: '/assets/images/team.webp' }))
      await writeFile(join(dir, 'media', 'index.html'), `${ld}<video src="/assets/videos/intro.mp4"></video><a href="/assets/files/menu.pdf">Menu</a>`)
      await writeFile(join(dir, '404.html'), ld)
      const errors: string[] = []

      await checkBuiltOutput(dir, (error) => errors.push(error), false)

      const missing = errors.filter((error) => error.includes('missing public asset'))
      expect(missing).toHaveLength(3)
      const joined = missing.join('\n')
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

      await writeFile(join(dir, '.pages.yml'), `media:\n  - name: images\n    input: C:\\outside\\images\n    output: /assets/images\n`)
      await expect(imageSourceRoots(dir)).rejects.toThrow('Invalid PagesCMS media.input "C:\\outside\\images"')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('rejects image source roots symlinked outside the project', async () => {
    const dir = await tempProject()
    const outside = await tempProject()
    try {
      await mkdir(join(dir, 'src'), { recursive: true })
      await symlink(outside, join(dir, 'src', 'images'))
      await expect(imageSourceRoots(dir)).rejects.toThrow('Image source root escapes the project')
    } finally {
      await rm(dir, { recursive: true, force: true })
      await rm(outside, { recursive: true, force: true })
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

  test('uses actual portrait variant widths in srcset descriptors', () => {
    const attrs = resolveImageAttrs({ portrait: {
      width: 600,
      height: 900,
      variants: [
        { file: 'portrait-320.webp', width: 213 },
        { file: 'portrait-640.webp', width: 427 },
        { file: 'portrait-900.webp', width: 600 },
      ],
    } }, { src: 'portrait', alt: 'Portrait' })
    expect(attrs.imgMain).toContain('/assets/images/portrait-320.webp 213w')
    expect(attrs.imgMain).toContain('/assets/images/portrait-640.webp 427w')
    expect(attrs.imgMain).toContain('/assets/images/portrait-900.webp 600w')
    expect(attrs.imgMain).toContain('width="600" height="900"')
  })

  test('does not enlarge a source smaller than the requested max', async () => {
    const dir = await tempProject()
    try {
      const srcDir = join(dir, 'src')
      const distDir = join(dir, 'dist')
      await mkdir(srcDir, { recursive: true })
      const png = 'iVBORw0KGgoAAAANSUhEUgAAADwAAABaCAIAAABrM6JiAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAPKADAAQAAAABAAAAWgAAAACdrWuxAAAA4klEQVRoBe3SwQkAIRDF0NH+e97tIKcgDMRr4CNPzzf7zt135Zku/erVkk4aBPoegKOmpFVOGEsacNSUtMoJY0kDjpqSVjlhLGnAUVPSKieMJQ04akpa5YSxpAFHTUmrnDCWNOCoKWmVE8aSBhw1Ja1ywljSgKOmpFVOGEsacNSUtMoJY0kDjpqSVjlhLGnAUVPSKieMJQ04akpa5YSxpAFHTUmrnDCWNOCoKWmVE8aSBhw1Ja1ywljSgKOmpFVOGEsacNSUtMoJY0kDjpqSVjlhLGnAUVPSKieMJQ04alop/QME/wGzn3VIjwAAAABJRU5ErkJggg=='
      await writeFile(join(srcDir, 'portrait.png'), Buffer.from(png, 'base64'))
      const meta = await processImages(srcDir, distDir, join(dir, 'cache'), { portrait: { max: 1200, quality: 82 } })
      expect(meta.portrait.width).toBe(60)
      expect(meta.portrait.height).toBe(90)
      expect(meta.portrait.variants).toEqual([{ file: 'portrait-90.webp', width: 60 }])
      const encoded = await Bun.file(join(distDir, 'portrait.webp')).image().metadata()
      expect(encoded.width).toBe(60)
      expect(encoded.height).toBe(90)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('accepts empty alt for decorative Image output', () => {
    const attrs = resolveImageAttrs({ decoration: { width: 400, height: 300 } }, {
      src: 'decoration',
      alt: '',
    })
    expect(attrs.imgMain).toContain('alt=""')
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

  test('keeps lazy Image output native and CSS-independent', () => {
    const attrs = resolveImageAttrs({ hero: { width: 1200, height: 800 } }, {
      src: 'hero',
      alt: 'Hero',
    })

    expect(attrs.imgTmp).toBe('')
    expect(attrs.imgMain).not.toContain('class=')
    expect(attrs.imgMain).toContain('loading="lazy"')
  })

  test('preserves non-SEO route head metadata', async () => {
    const composer = createComposer(new Map(), new Map(), () => ({}))
    const html = await composer.prepareRouteSource(`<head>
  <SEO title="About" description="About this organization." />
  <meta name="theme-color" content="#000">
</head>
<h1>About</h1>`, { slug: 'about', fileHint: 'src/pages/about.html' })
    expect(html).toContain('<meta name="theme-color" content="#000">')
    expect(html).toContain('<title>About</title>')
  })

  test('treats bare and quoted SEO unlisted flags as route policy', async () => {
    const composer = createComposer(new Map(), new Map(), () => ({}))
    for (const flag of ['unlisted', 'unlisted="true"']) {
      const route = await composer.prepareRoute(`<head><SEO title="Preview" ${flag} /></head><h1>Preview</h1>`, {
        slug: 'preview',
        fileHint: 'src/pages/preview.html',
      })
      expect(route.unlisted).toBe(true)
      expect(route.html).toContain('<meta name="robots" content="noindex,nofollow">')
      expect(route.html).toContain('<link rel="canonical" href="https://example.com/preview/">')
    }
  })

  test('keeps explicitly false SEO unlisted routes public', async () => {
    const composer = createComposer(new Map(), new Map(), () => ({}))
    const route = await composer.prepareRoute('<head><SEO title="Public" unlisted="false" /></head><h1>Public</h1>', {
      slug: 'public',
      fileHint: 'src/pages/public.html',
    })
    expect(route.unlisted).toBe(false)
    expect(route.html).not.toContain('name="robots"')
  })

  test('rejects duplicate route SEO directives', async () => {
    const composer = createComposer(new Map(), new Map(), () => ({}))
    expect(composer.prepareRouteSource('<head><SEO title="Head" /></head><SEO title="Body" /><h1>Page</h1>', {
      slug: 'page',
      fileHint: 'src/pages/page.html',
    })).rejects.toThrow('only accepted inside the route <head>')
  })

  test('rejects SEO directives in the shell', async () => {
    const composer = createComposer(new Map(), new Map(), () => ({}))
    expect(composer.prepareShellSource('<html><head><SEO /></head><body><main></main></body></html>'))
      .rejects.toThrow('route-only')
  })

  test('rejects non-self-closing SEO directives', async () => {
    const composer = createComposer(new Map(), new Map(), () => ({}))
    expect(composer.prepareRouteSource('<head><SEO title="Preview" unlisted></head><h1>Preview</h1>', {
      slug: 'preview',
      fileHint: 'src/pages/preview.html',
    })).rejects.toThrow('<SEO> must be self-closing')
  })

  test('rejects invalid SEO unlisted values', async () => {
    const composer = createComposer(new Map(), new Map(), () => ({}))
    expect(composer.prepareRoute('<head><SEO unlisted="private" /></head><h1>Preview</h1>', {
      slug: 'preview',
      fileHint: 'src/pages/preview.html',
    })).rejects.toThrow('attribute "unlisted" must be bare, "true", or "false"')
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

  test('points markdown alternate at the same-path alias and describes JSON plus llms.txt', async () => {
    const html = await composeRoute('about', 'src/pages/about.html')

    expect(html).toContain('<link rel="alternate" type="text/markdown" href="/about/index.md">')
    expect(html).toContain('<link rel="describedby" type="application/json" href="/routes/about.json">')
    expect(html).toContain('<link rel="describedby" href="/llms.txt">')
    expect(html).not.toContain('href="/routes/about.md"')
  })

  test('assigns stable heading ids on authored headings', async () => {
    const composer = createComposer(new Map(), new Map(), () => ({}))
    const html = await composer.prepareRouteSource('<head><SEO title="About" description="About this organization." /></head><h1>About</h1><h2>Next steps</h2>', {
      slug: 'about',
      fileHint: 'src/pages/about.html',
    })
    expect(html).toContain('<h1 id="about">About</h1>')
    expect(html).toContain('<h2 id="next-steps">Next steps</h2>')
  })

  test('emits twitter:site from a configured handle', async () => {
    const dir = await tempProject()
    try {
      await writeFile(join(dir, 'site.json'), JSON.stringify({
        name: 'Example',
        url: 'https://example.com',
        description: 'Useful site.',
        twitter: 'sttc',
      }))
      const composer = createComposer(new Map(), new Map(), () => ({}), undefined, undefined, undefined, {
        siteFile: join(dir, 'site.json'),
      })
      const html = await composer.prepareRouteSource('<head><SEO title="Home" description="Home page for the twitter handle test." /></head><h1>Home</h1>', {
        slug: 'index',
        fileHint: 'src/pages/index.html',
      })
      expect(html).toContain('<meta name="twitter:site" content="@sttc">')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
