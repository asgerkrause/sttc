import { projectPaths, root } from './paths'

export type BuildFlags = {
  allowBrokenLinks: boolean
  launch: boolean
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
  launch?: boolean
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
      launch: options.launch ?? argv.includes('--launch'),
    },
  }
}

// Per invocation: concurrent API builds must never replace global console methods.
export type BuildLogger = { log: (message: string) => void; warn: (message: string) => void }
