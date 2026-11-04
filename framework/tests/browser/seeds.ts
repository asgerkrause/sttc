import assert from 'node:assert/strict'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Browser } from 'playwright-core'
import { disclosure, inPage, mounts, reducedMotion } from './behavior'

export async function checkSeeds(browser: Browser, url: string, root: string) {
  const dist = join(root, 'dist')
  const scripts = join(dist, 'assets/js')
  const routerName = (await readdir(scripts)).find(name => /^router\..+\.js$/.test(name))
  assert.ok(routerName, 'generated router exists')
  const router = join(scripts, routerName)
  async function seed(name: string, file: string, pattern: RegExp, replacement: string, run: () => Promise<void>, failure: RegExp) {
    const original = await readFile(file, 'utf8')
    assert.equal([...original.matchAll(new RegExp(pattern, 'g'))].length, 1, `${name}: seed target must match exactly once`)
    try {
      await writeFile(file, original.replace(pattern, replacement))
      await assert.rejects(run, failure, `${name}: behavioral check must reject defect`)
      console.log(`PASS seed rejected: ${name}`)
    } finally { await writeFile(file, original) }
  }
  const mountCheck = () => inPage(browser, url, page => mounts(page, url))
  const disclosureCheck = () => inPage(browser, url, page => disclosure(page, url))
  await seed('duplicate mount', router, /let (\w+)=(\w+)\((\w+)\);if\(typeof/, '$2($3);let $1=$2($3);if(typeof', mountCheck, /header mounts once/)
  await seed('caught lifecycle error', router, /let (\w+)=(\w+)\((\w+)\);if\(typeof/, 'throw new Error("seed mount failure");let $1=$2($3);if(typeof',
    () => inPage(browser, url, async page => { await page.goto(url + '/') }), /browser console\/uncaught errors/)
  await seed('duplicate page event', router, /document\.dispatchEvent\(new CustomEvent\("snz:page",\{detail:\w+\}\)\)/, '$&;$&', mountCheck, /page event once/)
  await seed('Escape disabled', router, /"Escape"/, '"DisabledEscape"', disclosureCheck, /Escape closes disclosure/)
  await seed('Escape focus removed', router, /,\w+\.focus\(\)/, '', disclosureCheck, /Escape restores focus/)
  await seed('reduced-motion guard removed', join(scripts, 'scroll.js'), /if \(!reduceMotion\)/, 'if (true)',
    () => inPage(browser, url, page => reducedMotion(page, url)), /reduced motion (excludes Lenis|loads no Lenis assets)/)
  // Only damage the generated directory document, never shared runtime or authored sources.
  await seed('directory script path broken', join(dist, 'docs/index.html'), /src="\/assets\/js\/app\./, 'src="assets/js/app.',
    () => inPage(browser, url, page => mounts(page, url, '/docs/')), /header mounts once/)
}
