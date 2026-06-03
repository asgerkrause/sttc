import { isVersionAtLeast } from './migrations/version'
import { GENERATOR_VERSION } from './version'

if (!isVersionAtLeast(GENERATOR_VERSION, '0.0.0')) {
  throw new Error(`Invalid SANITIZE Boilerplate version: ${GENERATOR_VERSION}`)
}

console.log(`SANITIZE Boilerplate ${GENERATOR_VERSION}: no migrations yet. Project already at current shape.`)
