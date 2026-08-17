import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { PROJECT_FORMAT_VERSION } from '../version'

export const MIGRATION_STATE_FILE = '.snz/migrations.json'
export const LEGACY_MIGRATION_STATE_FILE = '.snz-bp.json'

export type MigrationState = {
  frameworkVersion: string
  appliedMigrations: string[]
}

export async function readMigrationState(root: string): Promise<MigrationState> {
  for (const file of [MIGRATION_STATE_FILE, LEGACY_MIGRATION_STATE_FILE]) {
    try {
      const raw = await readFile(join(root, file), 'utf8')
      const data = JSON.parse(raw) as Partial<MigrationState>
      return {
        frameworkVersion: data.frameworkVersion ?? '0.0.0',
        appliedMigrations: Array.isArray(data.appliedMigrations) ? data.appliedMigrations : [],
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
  }
  return { frameworkVersion: '0.0.0', appliedMigrations: [] }
}

export async function writeMigrationState(root: string, state: MigrationState): Promise<void> {
  const next: MigrationState = {
    frameworkVersion: PROJECT_FORMAT_VERSION,
    appliedMigrations: [...new Set(state.appliedMigrations)].sort(),
  }
  const path = join(root, MIGRATION_STATE_FILE)
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`)
}
