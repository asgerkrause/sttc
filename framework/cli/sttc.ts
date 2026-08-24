#!/usr/bin/env bun

import { spawn } from 'bun'
import { mkdir, readdir, stat } from 'fs/promises'
import { basename, join, resolve, sep } from 'path'

const frameworkRoot = join(import.meta.dir, '..')
const packageRoot = join(frameworkRoot, '..')
const args = process.argv.slice(2)
const cmd = args[0]
const rest = args.slice(1)

const commands: Record<string, string[]> = {
  dev: ['bun', join(frameworkRoot, 'dev.ts')],
  preview: ['bun', join(frameworkRoot, 'preview.ts')],
  build: ['bun', join(frameworkRoot, 'build', 'index.ts')],
  check: ['bun', join(frameworkRoot, 'build', 'check.ts')],
  new: ['bun', join(frameworkRoot, 'build', 'scaffold.ts')],
  skills: ['bun', join(frameworkRoot, 'build', 'skills.ts')],
  migrate: ['bun', join(frameworkRoot, 'build', 'migrate.ts')],
}

function usage(): never {
  console.error('Usage: sttc <create|dev|preview|build|check|doctor|new|skills|migrate> [...args]')
  process.exit(1)
}

async function run(command: string[]) {
  const proc = spawn([...command, ...rest], {
    cwd: process.cwd(),
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'inherit',
    env: process.env,
  })
  process.exit(await proc.exited)
}

async function exists(path: string) {
  try { await stat(path); return true } catch { return false }
}

function packageName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'sttc-site'
}

async function copyTemplate(source: string, target: string, prefix = ''): Promise<void> {
  await mkdir(target, { recursive: true })
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const relative = prefix ? join(prefix, entry.name) : entry.name
    const normalized = relative.split(sep).join('/')
    const top = normalized.split('/')[0]
    if (entry.name === '.DS_Store' || ['dist', 'node_modules', 'bun.lock', '.snz'].includes(top ?? '')) continue
    const from = join(source, entry.name)
    const to = join(target, entry.name)
    if (entry.isDirectory()) await copyTemplate(from, to, relative)
    else if (entry.isFile()) await Bun.write(to, Bun.file(from))
  }
}

async function createProject(targetArg: string | undefined) {
  if (!targetArg || targetArg.startsWith('-')) usage()
  const target = resolve(process.cwd(), targetArg)
  if (await exists(target)) {
    const visible = (await readdir(target)).filter((entry) => entry !== '.DS_Store')
    if (visible.length) {
      console.error(`refusing to write into non-empty directory: ${target}`)
      process.exit(2)
    }
  }

  const template = join(packageRoot, 'templates', 'default')
  if (!(await exists(template))) throw new Error('The @snz/sttc package is missing templates/default.')
  await copyTemplate(template, target)

  const rootPackage = JSON.parse(await Bun.file(join(packageRoot, 'package.json')).text())
  const targetPackagePath = join(target, 'package.json')
  const targetPackage = JSON.parse(await Bun.file(targetPackagePath).text())
  const packaged = process.env.STTC_CREATE_MODE === 'packaged' || !(await exists(join(packageRoot, '.git')))
  targetPackage.name = packageName(basename(target) || 'sttc-site')
  targetPackage.dependencies = {
    ...(targetPackage.dependencies ?? {}),
    '@snz/sttc': packaged ? `^${rootPackage.version}` : `file:${packageRoot}`,
  }
  await Bun.write(targetPackagePath, `${JSON.stringify(targetPackage, null, 2)}\n`)

  console.log(`Created ${targetPackage.name}`)
  console.log('')
  if (target !== process.cwd()) console.log(`  cd ${targetArg}`)
  console.log('  bun install')
  console.log('  bun dev')
}

if (!cmd) usage()
if (cmd === 'create') {
  await createProject(rest[0])
  process.exit(0)
}
if (cmd === 'doctor') {
  const check = spawn(['bun', join(frameworkRoot, 'build', 'check.ts'), ...rest], {
    cwd: process.cwd(), stdout: 'inherit', stderr: 'inherit', stdin: 'inherit', env: process.env,
  })
  process.exit(await check.exited)
}

const command = commands[cmd]
if (!command) usage()
await run(command)
