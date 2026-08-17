import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

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

  test('ships exactly seven components and copied CRFT CSS', async () => {
    const root = join(repoRoot, 'templates', 'default')
    const components = (await readdir(join(root, 'src', 'components'))).filter((file) => file.endsWith('.html')).sort()
    const styles = await readFile(join(root, 'src', 'styles.css'), 'utf8')
    const globalStyles = await readFile(join(root, 'src', 'styles', 'global.css'), 'utf8')
    const typeStyles = await readFile(join(root, 'src', 'styles', 'layers', 'type.css'), 'utf8')
    const layoutStyles = await readFile(join(root, 'src', 'styles', 'layers', 'layout.css'), 'utf8')
    const section = await readFile(join(root, 'src', 'components', 'Section.html'), 'utf8')
    const grid = await readFile(join(root, 'src', 'components', 'Grid.html'), 'utf8')
    expect(components).toEqual(['Footer.html', 'Grid.html', 'Header.html', 'Image.html', 'Logo.html', 'Section.html', 'Video.html'])
    expect(styles).toBe('@import "/assets/css/global.css";\n')
    expect(globalStyles).toContain('@layer base, tokens, type, layout, features, utility;')
    expect(typeStyles).toContain('font-family: "SNZ Sans"')
    expect(layoutStyles).toContain('[g]>[c$="12"]')
    expect(section).toContain('<section id="{{id}}" aria-label="{{label}}"><div class="c">')
    expect(grid).toContain('@attr cols Optional')
    expect(grid).toContain('<div g="{{cols}}" c="{{span}}" r="{{rows}}" o="{{order}}">')
    expect(grid).toContain('<div g c="{{span}}" r="{{rows}}" o="{{order}}">')
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
      expect(html).toContain('<h1>Case Study</h1>')
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
