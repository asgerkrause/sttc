import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { GENERATOR_VERSION } from '../version'

export const MIGRATION_STATE_FILE = '.snz-bp.json'

export type MigrationState = {
  frameworkVersion: string
  appliedMigrations: string[]
}

export async function readMigrationState(root: string): Promise<MigrationState> {
  try {
    const raw = await readFile(join(root, MIGRATION_STATE_FILE), 'utf8')
    const data = JSON.parse(raw) as Partial<MigrationState>
    return {
      frameworkVersion: data.frameworkVersion ?? '0.0.0',
      appliedMigrations: Array.isArray(data.appliedMigrations) ? data.appliedMigrations : [],
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    return { frameworkVersion: '0.0.0', appliedMigrations: [] }
  }
}

export async function writeMigrationState(root: string, state: MigrationState): Promise<void> {
  const next: MigrationState = {
    frameworkVersion: GENERATOR_VERSION,
    appliedMigrations: [...new Set(state.appliedMigrations)].sort(),
  }
  await writeFile(join(root, MIGRATION_STATE_FILE), `${JSON.stringify(next, null, 2)}\n`)
}
