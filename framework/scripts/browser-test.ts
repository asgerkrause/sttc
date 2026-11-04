import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { checkSeeds } from '../tests/browser/seeds'
import { cases } from '../tests/browser/behavior'
import { createFixture, startPreview } from '../tests/browser/fixture'

assert.ok(process.versions.bun, 'Browser gate must execute in Bun')
console.log(`Browser gate: Bun ${Bun.version}, executable ${process.execPath}`)
const fixture = await createFixture()
try {
  const preview = await startPreview(fixture.root, fixture.repo)
  try {
    const browser = await chromium.launch()
    console.log(`Chromium ${browser.version()}; one sequential worker, no retries`)
    try {
      const failures: string[] = []
      for (const [name, run] of cases(browser, preview.url)) {
        try { await run(); console.log(`PASS ${name}`) }
        catch (error) { failures.push(name); console.error(`FAIL ${name}`, error) }
      }
      if (process.argv.includes('--seeds')) await checkSeeds(browser, preview.url, fixture.root)
      assert.deepEqual(failures, [], 'browser gate failures')
    } finally { await browser.close() }
  } finally { await preview.stop() }
} finally { await fixture.remove() }
