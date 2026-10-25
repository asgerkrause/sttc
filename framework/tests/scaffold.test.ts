import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { prepareComponents } from '../build/components'
import { createComposer } from '../build/compose'
import { extractRouteStyleBlocks } from '../build/extract-css'
import { extractRouteTopScripts } from '../build/extract-js'
import { extractTemplateData } from '../build/template-data'

const frameworkRoot = join(import.meta.dir, '..')
const repoRoot = join(import.meta.dir, '..', '..')
const scaffoldPath = join(frameworkRoot, 'build', 'scaffold.ts')
const binPath = join(frameworkRoot, 'cli', 'sttc.ts')

type RunResult = { code: number; stdout: string; stderr: string }

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

describe('collection scaffold', () => {
  test('creates custom collection config, folder, template, and PagesCMS entry', async () => {
    const dir = await tempProject()
    try {
      const result = await runScaffold(['collection', 'projects', '--route', 'work/{slug}', '--template', 'project'], dir)
      const config = JSON.parse(await readFile(join(dir, 'content', 'collections.json'), 'utf8'))
      const template = await readFile(join(dir, 'src', 'templates', 'project.html'), 'utf8')
      const pages = await readFile(join(dir, '.pages.yml'), 'utf8')

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
      expect(result.stdout).toContain('Collection scaffold ready.')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('sttc new dispatches collection scaffold with defaults', async () => {
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
})

describe('create template surface', () => {
  test('one-package create skips generated and install artifacts', async () => {
    const dir = await tempProject()
    const templateRoot = join(repoRoot, 'templates', 'default')
    const artifacts = [join(templateRoot, 'dist'), join(templateRoot, 'node_modules'), join(templateRoot, '.snz'), join(templateRoot, 'bun.lock')]
    try {
      await mkdir(join(templateRoot, 'dist'), { recursive: true })
      await writeFile(join(templateRoot, 'dist', 'ignored.html'), 'ignored')
      await mkdir(join(templateRoot, 'node_modules'), { recursive: true })
      await mkdir(join(templateRoot, '.snz'), { recursive: true })
      await writeFile(join(templateRoot, '.snz', 'components-catalog.md'), '# ignored\n')
      await writeFile(join(templateRoot, 'bun.lock'), 'ignored')
      const target = join(dir, 'site')
      const result = await runBun(binPath, ['create', target], repoRoot)
      expect(result.code).toBe(0)
      for (const artifact of ['dist', 'node_modules', '.snz/components-catalog.md', 'bun.lock']) {
        expect(await Bun.file(join(target, artifact)).exists()).toBe(false)
      }
    } finally {
      for (const artifact of artifacts) await rm(artifact, { recursive: true, force: true })
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('ships exactly seven components and the flat Craft v3 package', async () => {
    const root = join(repoRoot, 'templates', 'default')
    const components = (await readdir(join(root, 'src', 'components'))).filter((file) => file.endsWith('.html')).sort()
    const styles = await readFile(join(root, 'src', 'styles.css'), 'utf8')
    const globalStyles = await readFile(join(root, 'src', 'styles', 'global.css'), 'utf8')
    const tokens = await readFile(join(root, 'src', 'styles', 'tokens.css'), 'utf8')
    const css = await readFile(join(root, 'src', 'styles', 'crft.css'), 'utf8')
    const manifest: unknown = JSON.parse(await readFile(join(root, 'src', 'styles', 'crft-manifest.json'), 'utf8'))
    expect(components).toEqual(['Footer.html', 'Grid.html', 'Header.html', 'Image.html', 'Logo.html', 'Section.html', 'Video.html'])
    expect(styles).toBe('@import "/assets/css/global.css";\n')
    expect(globalStyles).toContain('@layer reset, base, tokens, type, layout, grid, motion, utility, project;')
    expect(globalStyles).toContain('@import "./tokens.css";')
    expect(globalStyles).toContain('@import "./crft.css";')
    expect(globalStyles).not.toContain('./layers/')
    expect(await readdir(join(root, 'src', 'styles'))).not.toContain('layers')
    expect(manifest).toMatchObject({
      contractVersion: 3,
      packagingVersion: 1,
      layers: ['base', 'tokens', 'type', 'layout', 'grid', 'motion', 'utility'],
      fonts: false,
    })
    expect(tokens).toContain('Craft semantic contract: 3.')
    expect(css).toContain('Craft semantic contract: 3.')
    expect(css).toContain(':where(h3, h4, h5, h6),')
    expect(css).toContain('font-size: var(--h3-size)')
    expect(css).toContain('section > .c { container: container / inline-size; }')
    expect(css).toContain('[g]>[c$="12"]')
    expect(css).toContain('[g]>[r$="4"]')
    expect(css).not.toMatch(/\[(?:t|s|x|y)(?:[~|^$*]?=|\])/)
    expect(css).not.toContain('data-skin')
  })

  test('Section and Grid preserve inputs while rendering Craft v3 hooks', async () => {
    for (const root of [repoRoot, join(repoRoot, 'templates', 'default')]) {
      const { templates, schemas } = await prepareComponents(join(root, 'src', 'components'), root)
      const composer = createComposer(templates, schemas, () => ({}))
      const html = await composer.prepareRouteSource(`
<Section id="default" label="Overview"><p>Default</p></Section>
<Section id="small" c="sm"><p>Small</p></Section>
<Section id="large" c="lg"><Grid>Default grid</Grid><Grid cols="3-2" x="2-1" y="2-1" order="f-a-l">Nested grid</Grid></Section>`, {
        slug: 'example', fileHint: 'src/pages/example.html',
      })
      expect(html).toContain('<section id="default" aria-label="Overview">')
      expect(html).toContain('<div class="c"><p>Default</p></div>')
      expect(html).toContain('<div class="c sm"><p>Small</p></div>')
      expect(html).toContain('<div class="c lg">')
      expect(html).toContain('<div g>Default grid</div>')
      expect(html).toContain('<div g="3-2" c="2-1" r="2-1" o="f-a-l">Nested grid</div>')
      expect(html).not.toMatch(/\s[xy]=/)
    }
  })

  test('Header keeps navigation layout in bounded component CSS', async () => {
    for (const root of [repoRoot, join(repoRoot, 'templates', 'default')]) {
      const { templates, schemas, data, cssBlocks } = await prepareComponents(join(root, 'src', 'components'), root)
      const composer = createComposer(templates, schemas, () => ({}), undefined, undefined, data)
      const html = await composer.prepareShellSource('<Header />')
      const css = cssBlocks.filter((block) => block.source === 'Header.html').map((block) => block.css).join('\n')
      expect(html).toContain('<nav aria-label="Primary">')
      expect(html).toContain('<a href="/">Home</a>')
      expect(html).not.toMatch(/\s[cs](?:=|>)/)
      expect(css).toMatch(/body\s*>\s*header\s*\{/)
      expect(css).toContain('display: flex;')
      expect(css).toContain('flex-wrap: wrap;')
      expect(css).toContain('align-items: center;')
      expect(css).toContain('justify-content: space-between;')
    }
  })

  test('dogfood and starter routes use identified sections and current hooks', async () => {
    for (const root of [repoRoot, join(repoRoot, 'templates', 'default')]) {
      const { templates, schemas, data } = await prepareComponents(join(root, 'src', 'components'), root)
      const composer = createComposer(templates, schemas, () => ({}), undefined, undefined, data)
      const pages = join(root, 'src', 'pages')
      for await (const file of new Bun.Glob('**/*.html').scan(pages)) {
        const raw = await readFile(join(pages, file), 'utf8')
        const route = await extractTemplateData(raw, { file, projectRoot: root })
        const { html: body } = extractRouteStyleBlocks(extractRouteTopScripts(route.html, file).body)
        const html = await composer.prepareRouteSource(body, { slug: file.replace(/\.html$/, ''), fileHint: file, data: route.data })
        const ids: string[] = []
        const allIds: string[] = []
        const forbidden: string[] = []
        new HTMLRewriter()
          .on('main > section', { element(element) { ids.push(element.getAttribute('id') ?? '') } })
          .on('[id]', { element(element) { allIds.push(element.getAttribute('id') ?? '') } })
          .on('section[class], [t], [s], [x], [y], [data-skin]', { element(element) { forbidden.push(element.tagName) } })
          .transform(`<main>${html}</main>`)
        expect(ids.length, `${root}/${file}: direct main sections`).toBeGreaterThan(0)
        expect(ids.every((id) => id.trim().length > 0), `${root}/${file}: nonempty section IDs`).toBe(true)
        expect(new Set(allIds).size, `${root}/${file}: unique document IDs`).toBe(allIds.length)
        expect(forbidden, `${root}/${file}: legacy hooks or section classes`).toEqual([])
      }
    }
  })
})

describe('authoring scaffold', () => {
  test('creates nested route with basename title', async () => {
    const dir = await tempProject()
    try {
      const result = await runScaffold(['route', 'work/case-study'], dir)
      const html = await readFile(join(dir, 'src', 'pages', 'work', 'case-study.html'), 'utf8')
      expect(result.code).toBe(0)
      expect(html).toContain('<SEO title="Case Study" description="..." />')
      expect(html).toContain('<Section>')
      expect(html).toContain('<h1>Case Study</h1>')
      const composer = createComposer(new Map([['Section', '<section>{{slot}}</section>']]), new Map([['Section', { description: 'Project-owned wrapper.' }]]), () => ({}))
      expect(await composer.prepareRouteSource(html, { slug: 'work/case-study', fileHint: 'src/pages/work/case-study.html' }))
        .toContain('<section>')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('creates PascalCase component', async () => {
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

  test('component demo uses a native identified section without requiring Section', async () => {
    const dir = await tempProject()
    try {
      const page = join(dir, 'src', 'pages', 'styles.html')
      await mkdir(join(dir, 'src', 'pages'), { recursive: true })
      await writeFile(page, '<h1>Styles</h1>\n')
      const first = await runScaffold(['component', 'Hero', '--demo'], dir)
      const again = await runScaffold(['component', 'Hero', '--force', '--demo'], dir)
      const html = await readFile(page, 'utf8')
      expect(first.code).toBe(0)
      expect(again.code).toBe(0)
      expect(html).toContain('<section id="hero-demo-section"><Hero title="Hero demo">Demo content.</Hero></section>')
      const { templates, schemas } = await prepareComponents(join(dir, 'src', 'components'), dir)
      const composer = createComposer(templates, schemas, () => ({}))
      const rendered = await composer.prepareRouteSource(html, { slug: 'styles', fileHint: 'src/pages/styles.html' })
      expect(rendered).toContain('<h2 id="hero-demo">Hero demo</h2>')
      const ids: string[] = []
      new HTMLRewriter().on('[id]', { element(element) { ids.push(element.getAttribute('id') ?? '') } }).transform(rendered)
      expect(new Set(ids).size).toBe(ids.length)
      expect(rendered.match(/id="hero-demo-section"/g)).toHaveLength(1)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('cms scaffold remains opt-in', async () => {
    const dir = await tempProject()
    try {
      const cms = await runScaffold(['cms'], dir)
      const post = await runScaffold(['post', 'smoke-post'], dir)
      expect(cms.code).toBe(0)
      expect(cms.stdout).toContain('CMS scaffold ready')
      expect(post.code).toBe(0)
      expect(await readFile(join(dir, 'src', 'templates', 'post.html'), 'utf8')).toContain('/insights/{{basename}}/')
      expect(await readFile(join(dir, 'content', 'posts', 'smoke-post.md'), 'utf8')).toContain('title: Smoke Post')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
