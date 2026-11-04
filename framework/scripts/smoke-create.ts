#!/usr/bin/env bun

import { cp, mkdir, mkdtemp, readdir, rm, stat } from 'fs/promises'
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
const packedArchive = join(packedDir, `byak-sttc-${rootPackage.version}.tgz`)
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
    'src/styles.css', 'src/styles/global.css',
    'src/styles/tokens.css', 'src/styles/crft.css', 'src/styles/crft-manifest.json',
    'src/pages/index.html', 'src/pages/404.html', 'src/images/og.png', 'tsconfig.json', 'vercel.json', '.gitignore',
  ]) {
    if (!(await Bun.file(join(target, path)).exists())) throw new Error(`created starter missing ${path}`)
  }

  const stylesDir = join(target, 'src', 'styles')
  const styles = await readdir(stylesDir, { recursive: true })
  if (styles.includes('layers')) throw new Error('created starter includes legacy CSS layers')
  if (styles.some((path) => /\.(woff2?|ttf|otf)$/i.test(path))) throw new Error('created starter includes font assets')
  const manifest: unknown = JSON.parse(await Bun.file(join(stylesDir, 'crft-manifest.json')).text())
  if (!manifest || typeof manifest !== 'object'
    || !('contractVersion' in manifest) || manifest.contractVersion !== 3
    || !('packagingVersion' in manifest) || manifest.packagingVersion !== 1) {
    throw new Error('created starter has an invalid Craft v3 package manifest')
  }

  const components = (await readdir(join(target, 'src', 'components')))
    .filter((file) => file.endsWith('.html'))
    .sort()
  const expected = ['Footer.html', 'Grid.html', 'Header.html', 'Image.html', 'Logo.html', 'Section.html', 'Video.html']
  if (components.join(',') !== expected.join(',')) {
    throw new Error(`created starter has unexpected components: ${components.join(', ')}`)
  }

  for (const path of ['dist', 'node_modules', 'bun.lock', '.snz/components-catalog.md']) {
    if (await stat(join(target, path)).catch(() => null)) throw new Error(`created starter should not include ${path}`)
  }
}

// Only generated artifacts and dependency metadata may change during an upgrade.
async function ownedInputs(target: string) {
  const paths = (await readdir(target, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(target.length + 1))
    .filter((path) => !/^(node_modules|dist|\.snz)(\/|$)/.test(path)
      && !['package.json', 'bun.lock', 'bun.lockb'].includes(path))
    .sort()
  return Promise.all(paths.map(async (path) => ({
    path,
    hash: new Bun.CryptoHasher('sha256').update(await Bun.file(join(target, path)).arrayBuffer()).digest('hex'),
  })))
}

async function assertPreserved(target: string, before: Awaited<ReturnType<typeof ownedInputs>>) {
  const after = await ownedInputs(target)
  if (before.map(({ path }) => path).join('\n') !== after.map(({ path }) => path).join('\n')) {
    throw new Error('consumer owned path set changed')
  }
  for (const [index, entry] of before.entries()) {
    if (after[index]?.hash !== entry.hash) throw new Error(`consumer input changed: ${entry.path}`)
  }
}

async function assertConsumerOutput(target: string) {
  for (const [path, expected] of [
    ['index.html', 'Copper kestrel'],
    ['index.html', 'Handmade consumer component.'],
    ['index.html', 'Independent field journal'],
    ['archive/index.html', 'Consumer archive survives.'],
    ['insights/first-observation/index.html', 'The archived notebook remains readable.'],
  ]) {
    const file = Bun.file(join(target, 'dist', path))
    if (!(await file.exists()) || !(await file.text()).includes(expected)) {
      throw new Error(`consumer output missing: ${path}: ${expected}`)
    }
  }
  const styles: string[] = []
  const scripts: string[] = []
  new HTMLRewriter()
    .on('link[rel="stylesheet"]', { element(el) {
      const href = el.getAttribute('href')
      if (href?.startsWith('/assets/')) styles.push(href)
    } })
    .on('script[src]', { element(el) {
      const src = el.getAttribute('src')
      if (src?.startsWith('/assets/')) scripts.push(src)
    } }).transform(await Bun.file(join(target, 'dist/index.html')).text())
  const css = (await Promise.all(styles.map(path => Bun.file(join(target, 'dist', path.slice(1))).text()))).join('\n')
  if (!css.includes('--field-note-accent') || !css.includes('.field-note') || !css.includes('53rem')) {
    throw new Error('consumer CSS output missing')
  }
  const js = (await Promise.all(scripts.map(path => Bun.file(join(target, 'dist', path.slice(1))).text()))).join('\n')
  if (!js.includes('field-notes')) throw new Error('consumer app output missing')
}

async function expectFailure(label: string, check: () => Promise<void>, message: string) {
  try {
    await check()
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes(message)) throw error
    console.log(`consumer failure proof ok: ${label}`)
    return
  }
  throw new Error(`consumer failure proof did not reject: ${label}`)
}

async function assertConsumerUpgrade() {
  const target = join(root, 'consumer-upgrade')
  await cp(join(repoRoot, 'framework/tests/fixtures/consumer-upgrade'), target, { recursive: true })
  const before = await ownedInputs(target)
  await run(['bun', 'add', packedArchive], target)
  await assertPreserved(target, before)
  const candidate = join(target, 'node_modules/@byak/sttc/framework/cli/sttc.ts')
  for (const command of ['build', 'check', 'doctor']) await run(['bun', candidate, command], target)
  await assertConsumerOutput(target)
  await assertPreserved(target, before)

  const home = join(target, 'dist/index.html')
  const originalHome = await Bun.file(home).text()
  for (const [selector, message] of [
    ['link[href*="/styles."]', 'consumer CSS output missing'],
    ['link[href*="/components."]', 'consumer CSS output missing'],
    ['script[src*="/app."]', 'consumer app output missing'],
  ]) {
    try {
      await Bun.write(home, new HTMLRewriter().on(selector, { element(el) { el.remove() } }).transform(originalHome))
      await expectFailure(`unreferenced asset: ${selector}`, () => assertConsumerOutput(target), message)
    } finally { await Bun.write(home, originalHome) }
  }
  await assertConsumerOutput(target)

  // Seed damage only in the disposable consumer, restoring each input afterward.
  for (const [path, damage, message] of [
    ['src/styles.css', 'overwrite', 'consumer input changed: src/styles.css'],
    ['src/pages/archive.html', 'delete', 'consumer owned path set changed'],
  ]) {
    const file = join(target, path)
    const original = await Bun.file(file).text()
    try {
      if (damage === 'delete') await rm(file)
      else await Bun.write(file, 'body { color: red; }')
      await expectFailure(damage, () => assertPreserved(target, before), message)
    } finally {
      await Bun.write(file, original)
    }
  }

  const originalCli = await Bun.file(candidate).text()
  try {
    // Simulate a candidate that newly requires a starter-owned Craft file.
    await Bun.write(candidate, originalCli.replace('\n', '\nawait Bun.file("src/styles/crft-manifest.json").text();\n'))
    const missingDependency = Bun.spawn(['bun', candidate, 'build'], {
      cwd: target, stdout: 'ignore', stderr: 'pipe',
    })
    const diagnostic = await new Response(missingDependency.stderr).text()
    if (await missingDependency.exited === 0 || !diagnostic.includes('ENOENT')
      || !diagnostic.includes('src/styles/crft-manifest.json')) {
      throw new Error('consumer failure proof did not reject the new required starter file')
    }
    console.log('consumer failure proof ok: new required starter file')
    await rm(join(target, 'dist'), { recursive: true, force: true })
    await Bun.write(candidate, 'process.exit(0)\n')
    await run(['bun', candidate, 'build'], target)
    await expectFailure('successful candidate without output', () => assertConsumerOutput(target), 'consumer output missing: index.html')
  } finally {
    await Bun.write(candidate, originalCli)
  }
  await run(['bun', candidate, 'build'], target)
  await assertConsumerOutput(target)
  await assertPreserved(target, before)
  console.log(`consumer upgrade ok: ${before.length} owned files preserved`)
}

try {
  await run(['bun', cli, 'create', localTarget])
  await assertStarter(localTarget)
  const localDependency = (await readPackage(localTarget)).dependencies?.['@byak/sttc']
  if (!localDependency?.startsWith('file:')) throw new Error('local create did not write file: @byak/sttc dependency')
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
  const packagedDependency = (await readPackage(packagedTarget)).dependencies?.['@byak/sttc']
  if (packagedDependency !== expectedVersion) {
    throw new Error(`packaged create wrote ${packagedDependency}; expected ${expectedVersion}`)
  }
  const installedCli = join(packedHarness, 'node_modules', '@byak', 'sttc', 'framework', 'cli', 'sttc.ts')
  await run(['bun', installedCli, 'doctor'], packagedTarget)

  await assertConsumerUpgrade()

  await mkdir(dotTarget)
  await run(['bun', cli, 'create', '.'], dotTarget)
  await assertStarter(dotTarget)

  console.log(`create smoke ok: ${root}`)
} finally {
  await rm(root, { recursive: true, force: true })
}
