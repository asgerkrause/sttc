import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const packageRoot = join(import.meta.dir, '..')
const scaffoldPath = join(packageRoot, 'build', 'scaffold.ts')
const binPath = join(packageRoot, 'bin', 'snz-bp.ts')

type RunResult = {
  code: number
  stdout: string
  stderr: string
}

async function tempProject(prefix = 'snz-scaffold-') {
  return mkdtemp(join(tmpdir(), prefix))
}

async function runBun(entry: string, args: string[], cwd: string): Promise<RunResult> {
  const proc = Bun.spawn(['bun', entry, ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: 'ignore',
    env: process.env,
  })

  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  return { code, stdout, stderr }
}

async function runScaffold(args: string[], cwd: string) {
  return runBun(scaffoldPath, args, cwd)
}

async function copyBuiltInComponents(destRoot: string) {
  const source = join(packageRoot, 'src', 'components')
  const dest = join(destRoot, 'src', 'components')
  await mkdir(dest, { recursive: true })

  for (const file of await readdir(source)) {
    if (!file.endsWith('.html')) continue
    await writeFile(join(dest, file), await readFile(join(source, file), 'utf8'))
  }
}

async function writeMinimalSite(root: string) {
  await mkdir(join(root, 'src', 'pages'), { recursive: true })
  await mkdir(join(root, 'src', 'styles'), { recursive: true })

  await writeFile(join(root, 'src', 'site.json'), JSON.stringify({
    name: 'Preset Test',
    url: 'https://example.com',
    description: 'Preset fixture.',
    locale: 'en',
    scroll: 'native',
  }, null, 2))

  await writeFile(join(root, 'src', 'shell.html'), `<!doctype html>
<html lang="en" data-scroll="{{scroll}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <SEO path="/" />
  <link rel="stylesheet" href="/assets/css/styles.css">
  <!-- @snz-components-css -->
  <script src="/router.js" type="module"></script>
  <script src="/assets/js/app.js" type="module"></script>
</head>
<body>
  <main data-route-root></main>
</body>
</html>
`)

  await writeFile(join(root, 'src', 'styles.css'), ':root{--by:4rem;--bx:1rem;--gp:1rem;--pd:.75rem;--pd-sm:.5rem;--pd-lg:1.25rem;--br:.5rem;--bw:1px;--b:#ddd;--i:#111;--s:#fff;--g:#555;--t:#f6f6f6;--n05:#f6f6f6;--a:#111;--a05:#eee;--a10:#ddd;--a60:#555;--a80:#333;--a-i:#fff;--c:#111;--c05:#eee;--c10:#ddd;--c60:#555;--c-i:#fff;--fmw:60ch;--fs-sm:.875rem;--h0-fs:4rem;--h0-lh:1;--h2-fs:2rem;--h2-lh:1.1}.c{max-width:72rem;margin-inline:auto;padding-inline:var(--bx)}.w>*+*{margin-top:var(--gp)}[g]{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:var(--gp)}[g]>*{grid-column:span 4}@media(width < 60rem){[g]>*{grid-column:1/-1}}')
  await writeFile(join(root, 'src', 'app.js'), '')
}

describe('collection scaffold', () => {
  test('creates custom collection config, folder, template, and PagesCMS entry', async () => {
    const dir = await tempProject()
    try {
      const result = await runScaffold(['collection', 'projects', '--route', 'work/{slug}', '--template', 'project'], dir)
      const config = JSON.parse(await readFile(join(dir, 'content', 'collections.json'), 'utf8'))
      const template = await readFile(join(dir, 'src', 'templates', 'project.html'), 'utf8')
      const pages = await readFile(join(dir, '.pages.yml'), 'utf8')
      const gitkeep = await readFile(join(dir, 'content', 'projects', '.gitkeep'), 'utf8')

      expect(result.code).toBe(0)
      expect(config.collections[0]).toMatchObject({
        name: 'projects',
        label: 'Projects',
        path: 'content/projects',
        template: 'project.html',
        route: 'work/{slug}',
        required: ['title'],
      })
      expect(template).toContain('<SEO title="{{title}}" description="{{description}}" path="/work/{{basename}}/" />')
      expect(template).toContain('{{body}}')
      expect(pages).toContain('name: projects')
      expect(pages).toContain('path: content/projects')
      expect(gitkeep).toBe('')
      expect(result.stdout).toContain('Collection scaffold ready.')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('snz-bp new dispatches collection scaffold with defaults', async () => {
    const dir = await tempProject()
    try {
      const result = await runBun(binPath, ['new', 'collection', 'services'], dir)
      const config = JSON.parse(await readFile(join(dir, 'content', 'collections.json'), 'utf8'))

      expect(result.code).toBe(0)
      expect(config.collections[0].route).toBe('services/{slug}')
      expect(config.collections[0].template).toBe('service.html')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('usage documents collection command', async () => {
    const dir = await tempProject()
    try {
      const result = await runScaffold([], dir)

      expect(result.code).toBe(1)
      expect(result.stderr).toContain('bun run new collection <name> [--route <pattern>] [--template <name>] [--label <label>] [--force]')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('rejects invalid collection route with clear error', async () => {
    const dir = await tempProject()
    try {
      const result = await runScaffold(['collection', 'projects', '--route', 'work'], dir)

      expect(result.code).toBe(1)
      expect(result.stderr).toContain('collection route must contain exactly one {slug} token')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('refuses to replace existing collection config without force', async () => {
    const dir = await tempProject()
    try {
      const first = await runScaffold(['collection', 'projects'], dir)
      const second = await runScaffold(['collection', 'projects'], dir)

      expect(first.code).toBe(0)
      expect(second.code).toBe(2)
      expect(second.stderr).toContain('collection "projects" already exists')
      expect(second.stderr).toContain('pass --force to replace')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('component preset scaffold', () => {
  test('keeps new component scaffold separate from presets', async () => {
    const dir = await tempProject()
    try {
      const ok = await runScaffold(['component', 'Hero'], dir)
      const bad = await runScaffold(['component', 'hero'], dir)
      const html = await readFile(join(dir, 'src', 'components', 'Hero.html'), 'utf8')

      expect(ok.code).toBe(0)
      expect(html).toContain('@desc Hero — TODO describe what this component does.')
      expect(bad.code).toBe(1)
      expect(bad.stderr).toContain('component name must be PascalCase (got "hero")')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('adds hero preset as PascalCase component file', async () => {
    const dir = await tempProject()
    try {
      const result = await runScaffold(['add', 'component', 'hero'], dir)
      const html = await readFile(join(dir, 'src', 'components', 'HeroSection.html'), 'utf8')

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('Added HeroSection')
      expect(html).toContain('@desc Hero section preset')
      expect(html).toContain('<Section>')
      expect(html).toContain('<Button href="/" label="Start project" />')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('snz-bp add dispatches to preset scaffold', async () => {
    const dir = await tempProject()
    try {
      const result = await runBun(binPath, ['add', 'component', 'logos'], dir)
      const html = await readFile(join(dir, 'src', 'components', 'LogoCloud.html'), 'utf8')

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('Added LogoCloud')
      expect(html).toContain('@desc Logo cloud preset')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('snz-bp add dispatches to theme scaffold', async () => {
    const dir = await tempProject()
    try {
      await mkdir(join(dir, 'src'), { recursive: true })
      await writeFile(join(dir, 'src', 'styles.css'), 'body { color: var(--i); }\n')

      const result = await runBun(binPath, ['add', 'theme', 'brutalist'], dir)
      const css = await readFile(join(dir, 'src', 'styles.css'), 'utf8')

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('applied brutalist theme')
      expect(css).toContain('/* snz-bp theme:start */')
      expect(css).toContain('/* brutalist token pack. Safe to edit after applying. */')
      expect(css).toContain('--bw: 0.2rem;')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('cms scaffold creates collection config, templates, and entries', async () => {
    const dir = await tempProject()
    try {
      const cms = await runScaffold(['cms'], dir)
      const post = await runScaffold(['post', 'smoke-post'], dir)
      const page = await runScaffold(['page', 'about-us'], dir)

      expect(cms.code).toBe(0)
      expect(cms.stdout).toContain('CMS scaffold ready')
      expect(post.code).toBe(0)
      expect(page.code).toBe(0)
      expect(await readFile(join(dir, '.pages.yml'), 'utf8')).toContain('path: content/posts')
      expect(await readFile(join(dir, 'content', 'README.md'), 'utf8')).toContain('content/posts/')
      expect(await readFile(join(dir, 'src', 'templates', 'post.html'), 'utf8')).toContain('/insights/{{basename}}/')
      expect(await readFile(join(dir, 'src', 'templates', 'page.html'), 'utf8')).toContain('/{{basename}}/')
      expect(await readFile(join(dir, 'content', 'posts', 'smoke-post.md'), 'utf8')).toContain('title: Smoke Post')
      expect(await readFile(join(dir, 'content', 'pages', 'about-us.md'), 'utf8')).toContain('title: About Us')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('appends preset demo to styles page when requested', async () => {
    const dir = await tempProject()
    try {
      await mkdir(join(dir, 'src', 'pages'), { recursive: true })
      await writeFile(join(dir, 'src', 'pages', 'styles.html'), '<Section><h1>Styles</h1></Section>\n')

      const result = await runScaffold(['add', 'component', 'testimonial', '--demo'], dir)
      const html = await readFile(join(dir, 'src', 'components', 'TestimonialSection.html'), 'utf8')
      const styles = await readFile(join(dir, 'src', 'pages', 'styles.html'), 'utf8')

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('appended demo to')
      expect(result.stdout).toContain('Added TestimonialSection')
      expect(html).toContain('@desc Testimonial section preset')
      expect(styles).toContain('<TestimonialSection />')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('rejects unknown preset with available list', async () => {
    const dir = await tempProject()
    try {
      const result = await runScaffold(['add', 'component', 'gallery'], dir)

      expect(result.code).toBe(1)
      expect(result.stderr).toContain('unknown component preset "gallery"')
      expect(result.stderr).toContain('Available presets: hero, logos, pricing, testimonial, faq')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('refuses to overwrite existing preset target', async () => {
    const dir = await tempProject()
    try {
      await mkdir(join(dir, 'src', 'components'), { recursive: true })
      await writeFile(join(dir, 'src', 'components', 'HeroSection.html'), 'existing')

      const result = await runScaffold(['add', 'component', 'hero'], dir)

      expect(result.code).toBe(2)
      expect(result.stderr).toContain('refusing to overwrite')
      expect(result.stderr).toContain('HeroSection.html')
      expect(result.stderr).toContain('pass --force to overwrite')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('generated presets compose in build pipeline', async () => {
    const dir = await tempProject('snz-scaffold-build-')
    try {
      await copyBuiltInComponents(dir)
      await writeMinimalSite(dir)

      for (const preset of ['hero', 'logos', 'pricing', 'testimonial', 'faq']) {
        const result = await runScaffold(['add', 'component', preset], dir)
        expect(result.code).toBe(0)
      }

      await writeFile(join(dir, 'src', 'pages', 'index.html'), `<HeroSection />
<LogoCloud />
<PricingSection />
<TestimonialSection />
<FAQSection />
`)

      const result = await runBun(join(packageRoot, 'build', 'index.ts'), [], dir)

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('total')
      expect(result.stderr).toContain('images: no OG source')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
