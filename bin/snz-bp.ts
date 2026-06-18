#!/usr/bin/env bun

import { spawn } from 'bun'
import { join } from 'path'

const packageRoot = join(import.meta.dir, '..')
const args = process.argv.slice(2)
const cmd = args[0]
const rest = args.slice(1)

const commands: Record<string, string[]> = {
  dev: ['bun', join(packageRoot, 'dev.ts')],
  build: ['bun', join(packageRoot, 'build', 'index.ts')],
  check: ['bun', join(packageRoot, 'build', 'check.ts')],
  'css:audit': ['bun', join(packageRoot, 'build', 'css-audit.ts')],
  new: ['bun', join(packageRoot, 'build', 'scaffold.ts')],
  add: ['bun', join(packageRoot, 'build', 'add.ts')],
  migrate: ['bun', join(packageRoot, 'build', 'migrate.ts')],
}

function usage(): never {
  console.error(`Usage: snz-bp <dev|build|check|doctor|css:audit|new|add|migrate> [...args]`)
  process.exit(1)
}

if (!cmd) usage()

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

if (cmd === 'doctor') {
  const audit = spawn(['bun', join(packageRoot, 'build', 'css-audit.ts'), ...rest], {
    cwd: process.cwd(), stdout: 'inherit', stderr: 'inherit', stdin: 'inherit', env: process.env,
  })
  const auditCode = await audit.exited
  if (auditCode !== 0) process.exit(auditCode)
  const check = spawn(['bun', join(packageRoot, 'build', 'check.ts'), ...rest], {
    cwd: process.cwd(), stdout: 'inherit', stderr: 'inherit', stdin: 'inherit', env: process.env,
  })
  process.exit(await check.exited)
}

const command = commands[cmd]
if (!command) usage()
await run(command)
