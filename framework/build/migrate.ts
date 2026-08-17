import { runMigrations } from './migrations/registry'
import { PROJECT_FORMAT_VERSION } from './version'

const dryRun = process.argv.includes('--dry-run')
const results = await runMigrations(process.cwd(), { dryRun })

console.log(`STTC project format ${PROJECT_FORMAT_VERSION} migrate${dryRun ? ' --dry-run' : ''}`)

if (!results.length) {
  console.log('No migrations to run. Project already at current shape.')
  process.exit(0)
}

for (const result of results) {
  console.log(`\n${result.id}: ${result.description}`)
  for (const action of result.actions) {
    console.log(`- ${action.status}: ${action.message}`)
  }
}

if (results.some((result) => result.actions.some((action) => action.status === 'conflict'))) {
  console.error(`\nMigration ${dryRun ? 'would stop' : 'stopped'} with conflicts. Move or remove destination files, then rerun.`)
  if (!dryRun) process.exit(1)
}
