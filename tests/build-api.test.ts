import { describe, expect, test } from 'bun:test'
import { join } from 'path'
import { createBuildContext } from '../build/build-context'
import { build } from '../build/index'

describe('build API spine', () => {
  test('creates context from current project paths and flags', () => {
    const context = createBuildContext({ argv: ['bun', 'build/index.ts', '--allow-broken-links'] })

    expect(context.rootDir).toBe(process.cwd())
    expect(context.srcDir).toBe(join(process.cwd(), 'src'))
    expect(context.distDir).toBe(join(process.cwd(), 'dist'))
    expect(context.flags.allowBrokenLinks).toBe(true)
  })

  test('exposes build without running CLI side effects on import', () => {
    expect(typeof build).toBe('function')
  })
})
