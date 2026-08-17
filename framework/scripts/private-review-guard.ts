#!/usr/bin/env bun

import { join } from 'path'

type PackageJson = {
  name?: unknown
  private?: unknown
  publishConfig?: unknown
  scripts?: Record<string, unknown>
}

const repoRoot = process.env.STTC_PRIVATE_GUARD_ROOT ?? join(import.meta.dir, '..', '..')

const packageGuards = [
  {
    path: 'package.json',
    expectedName: '@snz/sttc',
  },
  {
    path: 'templates/default/package.json',
    expectedName: 'sttc-site',
  },
] as const

const forbiddenScriptNames = new Set(['publish', 'prepublish', 'prepublishOnly', 'postpublish'])

async function readPackage(relativePath: string) {
  const file = Bun.file(join(repoRoot, relativePath))
  if (!(await file.exists())) {
    throw new Error(`${relativePath}: missing package.json`)
  }
  return JSON.parse(await file.text()) as PackageJson
}

function assertPrivate(pkg: PackageJson, relativePath: string) {
  if (pkg.private !== true) {
    throw new Error(`${relativePath}: expected "private": true during private review`)
  }
}

function assertNoPublishConfig(pkg: PackageJson, relativePath: string) {
  if (pkg.publishConfig !== undefined) {
    throw new Error(`${relativePath}: publishConfig must stay absent during private review`)
  }
}

function assertNoPublishScripts(pkg: PackageJson, relativePath: string) {
  const scripts = pkg.scripts ?? {}
  for (const scriptName of Object.keys(scripts)) {
    if (forbiddenScriptNames.has(scriptName)) {
      throw new Error(`${relativePath}: ${scriptName} script must stay absent during private review`)
    }
  }
}

function assertName(pkg: PackageJson, relativePath: string, expectedName: string) {
  if (pkg.name !== expectedName) {
    throw new Error(`${relativePath}: expected package name ${expectedName}`)
  }
}

async function main() {
  for (const guard of packageGuards) {
    const pkg = await readPackage(guard.path)
    assertName(pkg, guard.path, guard.expectedName)
    assertPrivate(pkg, guard.path)
    assertNoPublishConfig(pkg, guard.path)
    assertNoPublishScripts(pkg, guard.path)
  }

  console.log('private review guard ok')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
