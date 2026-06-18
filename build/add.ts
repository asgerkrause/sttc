#!/usr/bin/env bun

import { spawn } from 'bun'
import { join } from 'path'

const packageRoot = join(import.meta.dir, '..')
const args = process.argv.slice(2)
const type = args[0]

const commands: Record<string, string[]> = {
  component: ['bun', join(packageRoot, 'build', 'scaffold.ts'), 'add'],
  theme: ['bun', join(packageRoot, 'build', 'theme-packs.ts')],
}

function usage(): never {
  console.error('Usage: snz-bp add component <hero|logos|pricing|testimonial|faq> [--force] [--demo]')
  console.error('       snz-bp add theme <minimal|editorial|brutalist> [--force]')
  process.exit(1)
}

if (!type) usage()
const command = commands[type]
if (!command) usage()

const proc = spawn([...command, ...args], {
  cwd: process.cwd(),
  stdout: 'inherit',
  stderr: 'inherit',
  stdin: 'inherit',
  env: process.env,
})

process.exit(await proc.exited)
