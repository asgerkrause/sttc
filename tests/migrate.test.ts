import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { MIGRATION_STATE_FILE, readMigrationState } from '../build/migrations/state'
import { runMigrations } from '../build/migrations/registry'

async function withProject(fn: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'snz-migrate-'))
  try {
    await fn(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

describe('migration registry', () => {
  test('dry-run reports legacy moves without writing files or state', async () => {
    await withProject(async (root) => {
      await mkdir(join(root, 'src/routes'), { recursive: true })
      await writeFile(join(root, 'src/routes/index.html'), '<h1>Home</h1>')

      const results = await runMigrations(root, { dryRun: true })

      expect(results.map((r) => r.id)).toEqual(['src-pages-layout'])
      expect(results[0].actions[0]).toMatchObject({
        from: 'src/routes',
        to: 'src/pages',
        status: 'planned',
      })
      expect(await readFile(join(root, 'src/routes/index.html'), 'utf8')).toBe('<h1>Home</h1>')
      expect(await readMigrationState(root)).toEqual({ frameworkVersion: '0.0.0', appliedMigrations: [] })
    })
  })

  test('applies file-shape migrations and records state', async () => {
    await withProject(async (root) => {
      await mkdir(join(root, 'src/routes'), { recursive: true })
      await mkdir(join(root, 'src/styles'), { recursive: true })
      await mkdir(join(root, 'src/app'), { recursive: true })
      await writeFile(join(root, 'src/routes/about.html'), '<h1>About</h1>')
      await writeFile(join(root, 'src/styles/styles.css'), 'body { color: black; }')
      await writeFile(join(root, 'src/app/app.js'), 'console.log("app")')

      const results = await runMigrations(root)

      expect(results.map((r) => r.id)).toEqual(['src-pages-layout', 'flat-styles-entry', 'flat-app-entry'])
      expect(await readFile(join(root, 'src/pages/about.html'), 'utf8')).toBe('<h1>About</h1>')
      expect(await readFile(join(root, 'src/styles.css'), 'utf8')).toBe('body { color: black; }')
      expect(await readFile(join(root, 'src/app.js'), 'utf8')).toBe('console.log("app")')

      const state = JSON.parse(await readFile(join(root, MIGRATION_STATE_FILE), 'utf8'))
      expect(state.appliedMigrations).toEqual(['flat-app-entry', 'flat-styles-entry', 'src-pages-layout'])
    })
  })

  test('is idempotent after migrations are recorded', async () => {
    await withProject(async (root) => {
      await mkdir(join(root, 'src/routes'), { recursive: true })
      await writeFile(join(root, 'src/routes/index.html'), '<h1>Home</h1>')

      expect((await runMigrations(root)).length).toBe(1)
      expect(await runMigrations(root)).toEqual([])
    })
  })

  test('reports conflicts without moving or recording migration', async () => {
    await withProject(async (root) => {
      await mkdir(join(root, 'src/routes'), { recursive: true })
      await mkdir(join(root, 'src/pages'), { recursive: true })
      await writeFile(join(root, 'src/routes/index.html'), '<h1>Legacy</h1>')
      await writeFile(join(root, 'src/pages/index.html'), '<h1>Current</h1>')

      const results = await runMigrations(root)

      expect(results[0].actions[0]).toMatchObject({ status: 'conflict' })
      expect(await readFile(join(root, 'src/routes/index.html'), 'utf8')).toBe('<h1>Legacy</h1>')
      expect(await readMigrationState(root)).toEqual({ frameworkVersion: '0.0.0', appliedMigrations: [] })
    })
  })
})
