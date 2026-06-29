import { readFileSync } from 'node:fs'

type PackageMetadata = {
  version?: string
  snzBp?: {
    generatorVersion?: string
  }
}

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as PackageMetadata

export const GENERATOR_NAME = '@snz/bp'
export const GENERATOR_VERSION = pkg.snzBp?.generatorVersion ?? pkg.version ?? '0.0.0'
