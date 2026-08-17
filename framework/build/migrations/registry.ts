import { access, mkdir, rename } from 'fs/promises'
import { dirname, join } from 'path'
import { PROJECT_FORMAT_VERSION } from '../version'
import { isVersionAtLeast } from './version'
import { readMigrationState, writeMigrationState, type MigrationState } from './state'

export type MigrationContext = {
  root: string
  dryRun: boolean
  state: MigrationState
}

export type MigrationAction = {
  kind: 'move'
  from: string
  to: string
  status: 'planned' | 'done' | 'skipped' | 'conflict'
  message: string
}

export type MigrationResult = {
  id: string
  description: string
  actions: MigrationAction[]
}

export type Migration = {
  id: string
  description: string
  introducedIn: string
  applies(ctx: MigrationContext): Promise<boolean>
  run(ctx: MigrationContext): Promise<MigrationAction[]>
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function movePath(ctx: MigrationContext, fromRel: string, toRel: string): Promise<MigrationAction> {
  const from = join(ctx.root, fromRel)
  const to = join(ctx.root, toRel)

  if (!(await exists(from))) {
    return { kind: 'move', from: fromRel, to: toRel, status: 'skipped', message: `${fromRel} missing` }
  }
  if (await exists(to)) {
    return { kind: 'move', from: fromRel, to: toRel, status: 'conflict', message: `${toRel} already exists` }
  }
  if (ctx.dryRun) {
    return { kind: 'move', from: fromRel, to: toRel, status: 'planned', message: `move ${fromRel} -> ${toRel}` }
  }

  await mkdir(dirname(to), { recursive: true })
  await rename(from, to)
  return { kind: 'move', from: fromRel, to: toRel, status: 'done', message: `moved ${fromRel} -> ${toRel}` }
}

async function hasAny(root: string, paths: string[]): Promise<boolean> {
  for (const path of paths) if (await exists(join(root, path))) return true
  return false
}

export const migrations: Migration[] = [
  {
    id: 'src-pages-layout',
    description: 'Move legacy src/routes to src/pages.',
    introducedIn: '2.0.0',
    applies: (ctx) => hasAny(ctx.root, ['src/routes']),
    run: (ctx) => moveAll(ctx, [['src/routes', 'src/pages']]),
  },
  {
    id: 'flat-styles-entry',
    description: 'Move legacy src/styles/styles.css to src/styles.css.',
    introducedIn: '2.0.0',
    applies: (ctx) => hasAny(ctx.root, ['src/styles/styles.css']),
    run: (ctx) => moveAll(ctx, [['src/styles/styles.css', 'src/styles.css']]),
  },
  {
    id: 'flat-app-entry',
    description: 'Move legacy src/app/app.js to src/app.js.',
    introducedIn: '2.0.0',
    applies: (ctx) => hasAny(ctx.root, ['src/app/app.js']),
    run: (ctx) => moveAll(ctx, [['src/app/app.js', 'src/app.js']]),
  },
]

async function moveAll(ctx: MigrationContext, moves: [string, string][]): Promise<MigrationAction[]> {
  const actions: MigrationAction[] = []
  for (const [from, to] of moves) actions.push(await movePath(ctx, from, to))
  return actions
}

async function rollbackMoves(root: string, results: MigrationResult[]) {
  const completed = results
    .flatMap((result) => result.actions)
    .filter((action) => action.status === 'done')
    .reverse()
  for (const action of completed) {
    const from = join(root, action.from)
    const to = join(root, action.to)
    await mkdir(dirname(from), { recursive: true })
    await rename(to, from)
  }
}

export async function runMigrations(root: string, options: { dryRun?: boolean } = {}): Promise<MigrationResult[]> {
  const state = await readMigrationState(root)
  const pending: Migration[] = []
  const previewContext: MigrationContext = { root, dryRun: true, state }

  for (const migration of migrations) {
    if (state.appliedMigrations.includes(migration.id)) continue
    if (!isVersionAtLeast(PROJECT_FORMAT_VERSION, migration.introducedIn)) continue
    if (await migration.applies(previewContext)) pending.push(migration)
  }

  const preview: MigrationResult[] = []
  for (const migration of pending) {
    const actions = await migration.run(previewContext)
    preview.push({ id: migration.id, description: migration.description, actions })
  }

  if (options.dryRun || preview.some((result) => result.actions.some((action) => action.status === 'conflict'))) {
    return preview
  }

  const context: MigrationContext = { root, dryRun: false, state }
  const results: MigrationResult[] = []
  for (const migration of pending) {
    const actions = await migration.run(context)
    results.push({ id: migration.id, description: migration.description, actions })
    if (actions.some((action) => action.status === 'conflict')) {
      await rollbackMoves(root, results)
      return results
    }
    state.appliedMigrations.push(migration.id)
  }

  if (results.length) await writeMigrationState(root, state)
  return results
}
