#!/usr/bin/env bun

import { mkdir, mkdtemp, readdir, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const repoRoot = join(import.meta.dir, '..', '..')
const cli = join(repoRoot, 'framework', 'cli', 'sttc.ts')
const root = await mkdtemp(join(tmpdir(), 'sttc-create-smoke-'))
const localTarget = join(root, 'site-local')
const packagedTarget = join(root, 'site-packaged')
const packedHarness = join(root, 'packed-harness')
const packedDir = join(root, 'packed')
const dotTarget = join(root, 'site-dot')
const rootPackage = JSON.parse(await Bun.file(join(repoRoot, 'package.json')).text())
const packedArchive = join(packedDir, `snz-sttc-${rootPackage.version}.tgz`)
const expectedVersion = `^${rootPackage.version}`

async function run(command: string[], cwd = repoRoot) {
  const proc = Bun.spawn(command, {
    cwd,
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'inherit',
    env: process.env,
  })
  const code = await proc.exited
  if (code !== 0) throw new Error(`${command.join(' ')} failed with exit code ${code}`)
}

async function readPackage(target: string) {
  return JSON.parse(await Bun.file(join(target, 'package.json')).text())
}

async function assertStarter(target: string) {
  for (const path of [
    'AGENTS.md', 'README.md', 'src/shell.html', 'src/site.json', 'src/app.ts', 'src/snz.d.ts',
    'src/styles.css', 'src/styles/global.css', 'src/styles/sans.ttf', 'src/styles/mono.ttf',
    'src/styles/layers/base.css', 'src/styles/layers/tokens.css', 'src/styles/layers/type.css',
    'src/styles/layers/layout.css', 'src/styles/layers/features.css', 'src/styles/layers/utility.css',
    'src/pages/index.html', 'src/pages/404.html', 'src/images/og.png', 'tsconfig.json', 'vercel.json',
  ]) {
    if (!(await Bun.file(join(target, path)).exists())) throw new Error(`created starter missing ${path}`)
  }

  const components = (await readdir(join(target, 'src', 'components')))
    .filter((file) => file.endsWith('.html'))
    .sort()
  const expected = ['Footer.html', 'Grid.html', 'Header.html', 'Image.html', 'Logo.html', 'Section.html', 'Video.html']
  if (components.join(',') !== expected.join(',')) {
    throw new Error(`created starter has unexpected components: ${components.join(', ')}`)
  }

  for (const path of ['dist', 'node_modules', 'bun.lock', '.snz/components-catalog.md']) {
    if (await Bun.file(join(target, path)).exists()) throw new Error(`created starter should not include ${path}`)
  }
}

try {
  await run(['bun', cli, 'create', localTarget])
  await assertStarter(localTarget)
  const localDependency = (await readPackage(localTarget)).dependencies?.['@snz/sttc']
  if (!localDependency?.startsWith('file:')) throw new Error('local create did not write file: @snz/sttc dependency')
  await run(['bun', 'install'], localTarget)
  await run(['bun', 'run', 'skills', 'sync', '--check'], localTarget)
  await run(['bun', 'run', 'new', 'route', 'smoke-page'], localTarget)
  await run(['bun', 'run', 'new', 'component', 'Hero'], localTarget)
  await run(['bun', 'run', 'doctor'], localTarget)

  await mkdir(packedDir)
  await mkdir(packedHarness)
  await Bun.write(join(packedHarness, 'package.json'), '{"name":"sttc-packed-smoke","private":true,"type":"module"}\n')
  await run(['bun', 'pm', 'pack', '--destination', packedDir, '--quiet'])
  await run(['bun', 'add', packedArchive], packedHarness)
  await run(['bunx', 'sttc', 'create', packagedTarget], packedHarness)
  await assertStarter(packagedTarget)
  const packagedDependency = (await readPackage(packagedTarget)).dependencies?.['@snz/sttc']
  if (packagedDependency !== expectedVersion) {
    throw new Error(`packaged create wrote ${packagedDependency}; expected ${expectedVersion}`)
  }
  const installedCli = join(packedHarness, 'node_modules', '@snz', 'sttc', 'framework', 'cli', 'sttc.ts')
  await run(['bun', installedCli, 'doctor'], packagedTarget)

  await mkdir(dotTarget)
  await run(['bun', cli, 'create', '.'], dotTarget)
  await assertStarter(dotTarget)

  console.log(`create smoke ok: ${root}`)
} finally {
  await rm(root, { recursive: true, force: true })
}
