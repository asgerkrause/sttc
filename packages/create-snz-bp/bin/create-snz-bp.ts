#!/usr/bin/env bun

import { mkdir, readdir, stat } from 'fs/promises'
import { basename, join, resolve } from 'path'

const createRoot = resolve(import.meta.dir, '..')
const repoRoot = resolve(import.meta.dir, '..', '..', '..')
const targetArg = process.argv[2]

type TemplateSource = {
  root: string
  bpDependency: string
}

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

async function readJson(path: string) {
  return JSON.parse(await Bun.file(path).text())
}

async function templateSource(): Promise<TemplateSource> {
  const localTemplate = join(repoRoot, 'templates', 'default')
  const localPackageJson = join(repoRoot, 'package.json')
  const forcePackaged = process.env.SNZ_BP_CREATE_MODE === 'packaged'
  if (!forcePackaged && await exists(localTemplate) && await exists(localPackageJson)) {
    return { root: localTemplate, bpDependency: `file:${repoRoot}` }
  }

  const packagedTemplate = join(createRoot, 'template', 'default')
  if (!(await exists(packagedTemplate))) {
    console.error('create-snz-bp package is missing template/default. Run the package prepare step before publishing.')
    process.exit(1)
  }

  const pkg = await readJson(join(createRoot, 'package.json'))
  const version = typeof pkg.version === 'string' ? pkg.version : 'latest'
  return { root: packagedTemplate, bpDependency: version === 'latest' ? 'latest' : `^${version}` }
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

await assertEmpty(target)
const source = await templateSource()
await copyTree(source.root, target)

const pkgPath = join(target, 'package.json')
const pkg = await readJson(pkgPath)
pkg.name = projectName
pkg.dependencies = {
  ...(pkg.dependencies ?? {}),
  '@snz/bp': source.bpDependency,
}
await Bun.write(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

console.log(`Created ${projectName}`)
console.log('')
if (!writesIntoCwd) console.log(`  cd ${targetArg}`)
console.log('  bun install')
console.log('  bun dev')
