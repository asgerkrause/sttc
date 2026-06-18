#!/usr/bin/env bun

import { mkdtemp, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const repoRoot = join(import.meta.dir, '..')
const creator = join(repoRoot, 'packages', 'create-snz-bp', 'bin', 'create-snz-bp.ts')
const root = await mkdtemp(join(tmpdir(), 'snz-create-smoke-'))
const localTarget = join(root, 'site-local')
const packagedTarget = join(root, 'site-packaged')
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

async function packageDependency(target: string) {
  const pkg = JSON.parse(await Bun.file(join(target, 'package.json')).text())
  return pkg.dependencies?.['@snz/bp']
}

try {
  await run(['bun', creator, localTarget])
  if (!(await packageDependency(localTarget)).startsWith('file:')) {
    throw new Error('local create did not write file: @snz/bp dependency')
  }
  await run(['bun', 'install'], localTarget)
  await run(['bun', 'run', 'check'], localTarget)

  await run(['bun', creator, packagedTarget], repoRoot, { SNZ_BP_CREATE_MODE: 'packaged' })
  const packagedDependency = await packageDependency(packagedTarget)
  if (packagedDependency !== expectedVersion) {
    throw new Error(`packaged create wrote ${packagedDependency}; expected ${expectedVersion}`)
  }

  console.log(`create smoke ok: ${root}`)
} finally {
  await rm(root, { recursive: true, force: true })
}
