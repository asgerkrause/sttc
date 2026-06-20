#!/usr/bin/env bun

import { mkdir, mkdtemp, readdir, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

const repoRoot = join(import.meta.dir, '..')
const source = join(repoRoot, 'templates', 'default')
const target = join(repoRoot, 'packages', 'create-snz-bp', 'template', 'default')
const checkOnly = process.argv.slice(2).includes('--check')
const ignoredEntries = new Set(['.DS_Store', 'dist', 'node_modules', 'bun.lock'])
const ignoredFiles = new Set(['docs/components-catalog.md'])

function shouldIgnore(relativePath: string) {
  const normalized = relativePath.split('\\').join('/')
  const [topLevel] = normalized.split('/')
  return ignoredEntries.has(topLevel ?? normalized) || ignoredFiles.has(normalized)
}

async function copyTree(src: string, dest: string, prefix = '') {
  await mkdir(dest, { recursive: true })
  for (const entry of await readdir(src, { withFileTypes: true })) {
    const relativePath = prefix ? join(prefix, entry.name) : entry.name
    if (shouldIgnore(relativePath)) continue
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)
    if (entry.isDirectory()) await copyTree(srcPath, destPath, relativePath)
    else if (entry.isFile()) await Bun.write(destPath, Bun.file(srcPath))
  }
}

async function rewriteTemplatePackage(templateRoot: string) {
  const rootPkg = JSON.parse(await Bun.file(join(repoRoot, 'package.json')).text())
  const version = typeof rootPkg.version === 'string' ? rootPkg.version : '0.0.0'
  const targetPkgPath = join(templateRoot, 'package.json')
  const targetPkg = JSON.parse(await Bun.file(targetPkgPath).text())
  targetPkg.dependencies = {
    ...(targetPkg.dependencies ?? {}),
    '@snz/bp': `^${version}`,
  }
  await Bun.write(targetPkgPath, `${JSON.stringify(targetPkg, null, 2)}\n`)
  return version
}

async function writeSyncedTemplate(dest: string) {
  await rm(dest, { recursive: true, force: true })
  await copyTree(source, dest)
  return rewriteTemplatePackage(dest)
}

async function listFiles(root: string, prefix = ''): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const relativePath = prefix ? join(prefix, entry.name) : entry.name
    if (shouldIgnore(relativePath)) continue
    if (entry.isDirectory()) files.push(...await listFiles(root, relativePath))
    else if (entry.isFile()) files.push(relativePath)
  }
  return files.sort()
}

async function bytesEqual(leftPath: string, rightPath: string) {
  const left = new Uint8Array(await Bun.file(leftPath).arrayBuffer())
  const right = new Uint8Array(await Bun.file(rightPath).arrayBuffer())
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

async function diffTrees(expectedRoot: string, actualRoot: string) {
  const expectedFiles = await listFiles(expectedRoot)
  const actualFiles = await listFiles(actualRoot)
  const expectedSet = new Set(expectedFiles)
  const actualSet = new Set(actualFiles)
  const diffs: string[] = []

  for (const file of expectedFiles) {
    if (!actualSet.has(file)) diffs.push(`missing ${file}`)
  }
  for (const file of actualFiles) {
    if (!expectedSet.has(file)) diffs.push(`extra ${file}`)
  }
  for (const file of expectedFiles) {
    if (!actualSet.has(file)) continue
    if (!(await bytesEqual(join(expectedRoot, file), join(actualRoot, file)))) {
      diffs.push(`changed ${file}`)
    }
  }

  return diffs
}

if (checkOnly) {
  const expected = await mkdtemp(join(tmpdir(), 'snz-create-template-'))
  try {
    await writeSyncedTemplate(expected)
    const diffs = await diffTrees(expected, target)
    if (diffs.length) {
      console.error('create-snz-bp template is out of sync with templates/default.')
      console.error('Run: bun run prepare:create-template')
      for (const diff of diffs) console.error(`- ${diff}`)
      process.exit(1)
    }
    console.log('create template sync ok')
  } finally {
    await rm(expected, { recursive: true, force: true })
  }
} else {
  const version = await writeSyncedTemplate(target)
  console.log(`synced ${source} -> ${target}`)
  console.log(`template @snz/bp dependency -> ^${version}`)
}
