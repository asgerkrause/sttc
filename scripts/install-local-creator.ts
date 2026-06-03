#!/usr/bin/env bun

import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'

const repoRoot = join(import.meta.dir, '..')
const binDir = join(process.env.HOME ?? '', '.bun', 'bin')
const shimPath = join(binDir, 'create-snz-bp')
const creatorPath = join(repoRoot, 'packages', 'create-snz-bp', 'bin', 'create-snz-bp.ts')

if (!process.env.HOME) {
  console.error('HOME not set; cannot install local creator shim')
  process.exit(1)
}

await mkdir(binDir, { recursive: true })
await writeFile(shimPath, `#!/usr/bin/env bash\nexec bun "${creatorPath}" "$@"\n`, { mode: 0o755 })

console.log(`Installed ${shimPath}`)
console.log('')
console.log('Use:')
console.log('  create-snz-bp my-client')
console.log('  create-snz-bp .')
