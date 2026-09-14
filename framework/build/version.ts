import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version?: string }

export const PACKAGE_NAME = '@snz/sttc'
export const PACKAGE_VERSION = pkg.version ?? '0.0.0'

// Discovery metadata retains its existing generator contract and reports package identity.
export const GENERATOR_NAME = PACKAGE_NAME
export const GENERATOR_VERSION = PACKAGE_VERSION
