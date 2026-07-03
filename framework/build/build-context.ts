import { projectPaths, root } from './paths'

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
  rootDir?: string
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
  const paths = projectPaths(options.rootDir ?? root)

  return {
    rootDir: paths.root,
    srcDir: paths.src,
    distDir: paths.dist,
    componentsDir: paths.componentsDir,
    shellFile: paths.shellFile,
    siteFile: paths.siteFile,
    flags: {
      allowBrokenLinks: options.allowBrokenLinks ?? argv.includes('--allow-broken-links'),
    },
  }
}
