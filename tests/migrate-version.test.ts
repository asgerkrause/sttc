import { describe, expect, test } from 'bun:test'
import { compareVersions, isVersionAtLeast, isVersionBefore, satisfiesVersion, sortVersions } from '../build/migrations/version'

describe('migration version helpers', () => {
  test('compares semver versions with Bun.semver ordering', () => {
    expect(compareVersions('1.2.0', '1.1.9')).toBe(1)
    expect(compareVersions('1.2.0', '1.2.0')).toBe(0)
    expect(compareVersions('1.2.0-alpha.1', '1.2.0')).toBe(-1)
  })

  test('checks before and at-least boundaries', () => {
    expect(isVersionBefore('1.1.0', '1.2.0')).toBe(true)
    expect(isVersionBefore('1.2.0', '1.2.0')).toBe(false)
    expect(isVersionAtLeast('1.2.0', '1.2.0')).toBe(true)
    expect(isVersionAtLeast('1.3.0', '1.2.0')).toBe(true)
  })

  test('checks migration target ranges', () => {
    expect(satisfiesVersion('1.2.0', '>=1.0.0 <2.0.0')).toBe(true)
    expect(satisfiesVersion('2.0.0', '>=1.0.0 <2.0.0')).toBe(false)
    expect(satisfiesVersion('1.2.0-alpha.1', '>=1.2.0')).toBe(false)
  })

  test('sorts versions in semver order', () => {
    expect(sortVersions(['1.10.0', '1.2.0', '1.2.0-alpha.1', '0.9.0'])).toEqual([
      '0.9.0',
      '1.2.0-alpha.1',
      '1.2.0',
      '1.10.0',
    ])
  })
})
