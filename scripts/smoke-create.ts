#!/usr/bin/env bun

import { mkdir, mkdtemp, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const repoRoot = join(import.meta.dir, '..')
const creator = join(repoRoot, 'packages', 'create-snz-bp', 'bin', 'create-snz-bp.ts')
const root = await mkdtemp(join(tmpdir(), 'snz-create-smoke-'))
const localTarget = join(root, 'site-local')
const packagedTarget = join(root, 'site-packaged')
const dotTarget = join(root, 'site-dot')
const rootPkg = JSON.parse(await Bun.file(join(repoRoot, 'package.json')).text())
const expectedVersion = `^${rootPkg.version}`

async function run(cmd: string[], cwd = repoRoot, env: Record<string, string> = {}) {
  const proc = Bun.spawn(cmd, {
    cwd,
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'inherit',
    env: { ...process.env, ...env },
  })
  const code = await proc.exited
  if (code !== 0) {
    throw new Error(`${cmd.join(' ')} failed with exit code ${code}`)
  }
}

async function packageJson(target: string) {
  return JSON.parse(await Bun.file(join(target, 'package.json')).text())
}

async function packageDependency(target: string) {
  const pkg = await packageJson(target)
  return pkg.dependencies?.['@snz/bp']
}

async function assertFile(target: string, relativePath: string) {
  if (!(await Bun.file(join(target, relativePath)).exists())) {
    throw new Error(`created starter missing ${relativePath}`)
  }
}

async function assertStarterSurface(target: string) {
  for (const file of [
    'AGENTS.md',
    'README.md',
    'src/shell.html',
    'src/site.json',
    'src/styles.css',
    'src/app.js',
    'tsconfig.json',
    'vercel.json',
    'src/pages/index.html',
    'src/pages/404.html',
    'src/pages/components.html',
    'src/components/Header.html',
    'src/components/Footer.html',
    'src/components/Section.html',
    'src/components/Button.html',
    'src/components/Card.html',
    'src/components/Accordion.html',
    'src/components/FAQ.html',
    'src/components/Image.html',
    'src/images/og.png',
    'src/images/showcase.png',
  ]) {
    await assertFile(target, file)
  }

  const scripts = (await packageJson(target)).scripts ?? {}
  for (const script of ['build', 'check', 'doctor', 'typecheck', 'new', 'add', 'migrate']) {
    if (typeof scripts[script] !== 'string') {
      throw new Error(`created starter missing package script "${script}"`)
    }
  }
}

try {
  await run(['bun', creator, localTarget])
  await assertStarterSurface(localTarget)
  if (!(await packageDependency(localTarget)).startsWith('file:')) {
    throw new Error('local create did not write file: @snz/bp dependency')
  }
  await run(['bun', 'install'], localTarget)
  await run(['bun', 'run', 'new', 'cms'], localTarget)
  await run(['bun', 'run', 'new', 'post', 'smoke-post'], localTarget)
  await run(['bun', 'run', 'new', 'page', 'smoke-page'], localTarget)
  await run(['bun', 'run', 'add', 'theme', 'minimal'], localTarget)
  await run(['bun', 'run', 'add', 'component', 'hero'], localTarget)
  await Bun.write(join(localTarget, 'src', 'pages', 'smoke.html'), `<head>
  <SEO title="Smoke" description="Smoke route." path="/smoke/" />
</head>
<HeroSection />
`)
  await run(['bun', 'run', 'doctor'], localTarget)

  await run(['bun', creator, packagedTarget], repoRoot, { SNZ_BP_CREATE_MODE: 'packaged' })
  await assertStarterSurface(packagedTarget)
  const packagedDependency = await packageDependency(packagedTarget)
  if (packagedDependency !== expectedVersion) {
    throw new Error(`packaged create wrote ${packagedDependency}; expected ${expectedVersion}`)
  }
  await run(['bun', join(repoRoot, 'bin', 'snz-bp.ts'), 'doctor'], packagedTarget)

  await mkdir(dotTarget)
  await run(['bun', creator, '.'], dotTarget)
  await assertStarterSurface(dotTarget)
  if (!(await packageDependency(dotTarget)).startsWith('file:')) {
    throw new Error('dot create did not write file: @snz/bp dependency')
  }

  console.log(`create smoke ok: ${root}`)
} finally {
  await rm(root, { recursive: true, force: true })
}
