export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  return Bun.semver.order(a, b) as -1 | 0 | 1
}

export function isVersionBefore(version: string, target: string): boolean {
  return compareVersions(version, target) < 0
}

export function isVersionAtLeast(version: string, target: string): boolean {
  return compareVersions(version, target) >= 0
}

export function satisfiesVersion(version: string, range: string): boolean {
  return Bun.semver.satisfies(version, range)
}

export function sortVersions(versions: string[]): string[] {
  return [...versions].sort(compareVersions)
}
