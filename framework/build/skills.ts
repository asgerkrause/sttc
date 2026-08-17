import { mkdir, readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const markerPattern = /<!-- @snz-skill ([a-z0-9-]+) ([a-f0-9]{64}) -->\n/

type SyncOptions = {
  sourceRoot: string
  projectRoot: string
  check?: boolean
}

type SyncResult = {
  code: number
  created: string[]
  updated: string[]
  unchanged: string[]
  missing: string[]
  conflicts: string[]
}

function bodyHash(content: string) {
  const match = content.match(markerPattern)
  if (!match) return undefined
  const body = content.replace(match[0], '')
  return {
    name: match[1],
    installedHash: match[2],
    currentHash: new Bun.CryptoHasher('sha256').update(body).digest('hex'),
  }
}

async function readOptional(path: string) {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

export async function syncSkills({ sourceRoot, projectRoot, check = false }: SyncOptions): Promise<SyncResult> {
  const result: SyncResult = {
    code: 0,
    created: [],
    updated: [],
    unchanged: [],
    missing: [],
    conflicts: [],
  }
  const writes: Array<{ name: string; path: string; content: string; kind: 'created' | 'updated' }> = []
  const entries = (await readdir(sourceRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))

  for (const entry of entries) {
    const name = entry.name
    const sourcePath = join(sourceRoot, name, 'SKILL.md')
    const destinationPath = join(projectRoot, '.agents', 'skills', name, 'SKILL.md')
    const source = await readFile(sourcePath, 'utf8')
    const sourceMarker = bodyHash(source)
    if (!sourceMarker || sourceMarker.name !== name || sourceMarker.currentHash !== sourceMarker.installedHash) {
      throw new Error(`invalid managed skill source: ${sourcePath}`)
    }

    const destination = await readOptional(destinationPath)
    if (destination === undefined) {
      result.missing.push(name)
      writes.push({ name, path: destinationPath, content: source, kind: 'created' })
      continue
    }
    if (destination === source) {
      result.unchanged.push(name)
      continue
    }

    const destinationMarker = bodyHash(destination)
    if (!destinationMarker || destinationMarker.name !== name || destinationMarker.currentHash !== destinationMarker.installedHash) {
      result.conflicts.push(name)
      continue
    }
    writes.push({ name, path: destinationPath, content: source, kind: 'updated' })
  }

  if (result.conflicts.length > 0) {
    result.code = 2
    return result
  }
  if (check) {
    if (writes.length > 0) result.code = 1
    return result
  }

  for (const write of writes) {
    await mkdir(join(write.path, '..'), { recursive: true })
    await writeFile(write.path, write.content)
    result[write.kind].push(write.name)
  }
  return result
}

async function main() {
  const args = process.argv.slice(2)
  if (args[0] !== 'sync' || args.some((arg) => !['sync', '--check'].includes(arg))) {
    console.error('Usage: sttc skills sync [--check]')
    process.exit(1)
  }
  const packageRoot = join(import.meta.dir, '..', '..')
  const result = await syncSkills({
    sourceRoot: join(packageRoot, 'templates', 'default', '.agents', 'skills'),
    projectRoot: process.cwd(),
    check: args.includes('--check'),
  })

  for (const key of ['created', 'updated', 'unchanged', 'missing', 'conflicts'] as const) {
    if (result[key].length > 0) console.log(`${key}: ${result[key].join(', ')}`)
  }
  process.exit(result.code)
}

if (import.meta.main) await main()
