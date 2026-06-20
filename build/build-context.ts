import {
  componentsDir,
  dist,
  root,
  shellFile,
  siteFile,
  src,
} from './paths'

export type BuildFlags = {
  allowBrokenLinks: boolean
}

export type BuildContext = {
  rootDir: string
  srcDir: string
  distDir: string
  componentsDir: string
  shellFile: string
  siteFile: string
  flags: BuildFlags
}

export type BuildContextOptions = {
  argv?: string[]
  allowBrokenLinks?: boolean
}

export type BuildResult = {
  context: BuildContext
  timings: Record<string, number>
  totalMs: number
  routes: string[]
  appJsFile: string
}

export function createBuildContext(options: BuildContextOptions = {}): BuildContext {
  const argv = options.argv ?? process.argv

  return {
    rootDir: root,
    srcDir: src,
    distDir: dist,
    componentsDir,
    shellFile,
    siteFile,
    flags: {
      allowBrokenLinks: options.allowBrokenLinks ?? argv.includes('--allow-broken-links'),
    },
  }
}
