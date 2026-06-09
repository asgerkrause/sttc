#!/usr/bin/env bun

import { mkdir, readdir, rm } from 'fs/promises'
import { join } from 'path'

const repoRoot = join(import.meta.dir, '..')
const source = join(repoRoot, 'templates', 'default')
const target = join(repoRoot, 'packages', 'create-snz-bp', 'template', 'default')

async function copyTree(src: string, dest: string) {
  await mkdir(dest, { recursive: true })
  for (const entry of await readdir(src, { withFileTypes: true })) {
    if (entry.name === '.DS_Store' || entry.name === 'dist' || entry.name === 'bun.lock') continue
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)
    if (entry.isDirectory()) await copyTree(srcPath, destPath)
    else if (entry.isFile()) await Bun.write(destPath, Bun.file(srcPath))
  }
}

await rm(target, { recursive: true, force: true })
await copyTree(source, target)

const rootPkg = JSON.parse(await Bun.file(join(repoRoot, 'package.json')).text())
const version = typeof rootPkg.version === 'string' ? rootPkg.version : '0.0.0'
const targetPkgPath = join(target, 'package.json')
const targetPkg = JSON.parse(await Bun.file(targetPkgPath).text())
targetPkg.dependencies = {
  ...(targetPkg.dependencies ?? {}),
  '@snz/bp': `^${version}`,
}
await Bun.write(targetPkgPath, `${JSON.stringify(targetPkg, null, 2)}\n`)

console.log(`synced ${source} -> ${target}`)
console.log(`template @snz/bp dependency -> ^${version}`)
