#!/usr/bin/env bun

import { spawn } from 'bun'
import { join } from 'path'
import { addComponentPreset } from './component-presets'

const packageRoot = join(import.meta.dir, '..')
const args = process.argv.slice(2)
const type = args[0]

const commands: Record<string, string[]> = {
  theme: ['bun', join(packageRoot, 'build', 'theme-packs.ts')],
}

function usage(): never {
  console.error('Usage: snz-bp add component <hero|cta|features|partners|pricing|testimonials|stats|process|faq|lottie> [--force] [--demo]')
  console.error('       snz-bp add theme <minimal|editorial|brutalist> [--force]')
  process.exit(1)
}

if (!type) usage()

if (type === 'component') {
  const name = args[1]
  if (!name) usage()
  await addComponentPreset(name, {
    force: args.includes('--force'),
    demo: args.includes('--demo'),
  })
  process.exit(0)
}

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
