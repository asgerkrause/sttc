#!/usr/bin/env bun

import { mkdir, readdir, stat } from 'fs/promises'
import { basename, join, resolve } from 'path'

const packageRoot = resolve(import.meta.dir, '..', '..', '..')
const templateRoot = join(packageRoot, 'templates', 'default')
const targetArg = process.argv[2]

function usage(): never {
  console.error('Usage: bun create snz-bp <project-dir>')
  process.exit(1)
}

if (!targetArg || targetArg.startsWith('-')) usage()

const target = resolve(process.cwd(), targetArg)
const projectName = sanitizePackageName(basename(target) || 'snz-bp-site')
const writesIntoCwd = target === process.cwd()

function sanitizePackageName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'snz-bp-site'
}

async function exists(path: string) {
  try { await stat(path); return true } catch { return false }
}

async function assertEmpty(path: string) {
  if (!(await exists(path))) return
  const entries = await readdir(path)
  const visible = entries.filter((entry) => entry !== '.DS_Store')
  if (visible.length) {
    console.error(`refusing to write into non-empty directory: ${path}`)
    process.exit(2)
  }
}

async function copyTree(src: string, dest: string) {
  await mkdir(dest, { recursive: true })
  for (const entry of await readdir(src, { withFileTypes: true })) {
    if (entry.name === '.DS_Store' || entry.name === 'dist') continue
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)
    if (entry.isDirectory()) await copyTree(srcPath, destPath)
    else if (entry.isFile()) await Bun.write(destPath, Bun.file(srcPath))
  }
}

await assertEmpty(target)
await copyTree(templateRoot, target)

const pkgPath = join(target, 'package.json')
const pkg = JSON.parse(await Bun.file(pkgPath).text())
pkg.name = projectName
pkg.dependencies = {
  ...(pkg.dependencies ?? {}),
  '@snz/bp': `file:${packageRoot}`,
}
await Bun.write(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

console.log(`Created ${projectName}`)
console.log('')
if (!writesIntoCwd) console.log(`  cd ${targetArg}`)
console.log('  bun install')
console.log('  bun dev')
