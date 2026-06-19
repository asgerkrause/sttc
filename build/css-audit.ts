import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { sourceStylesDir, sourceStylesFile } from './paths'

const blocked = [
  { selector: '.card', owner: 'src/components/Card.html' },
  { selector: '.grid', owner: 'src/components/Grid.html (use [g])' },
  { selector: '.stack', owner: 'deprecated (use .w)' },
  { selector: '.section', owner: 'src/components/Section.html (no root class)' },
  { selector: '.faq', owner: 'src/components/FAQ.html' },
  { selector: '.code', owner: 'src/components/Code.html' },
  { selector: '.img-w', owner: 'src/components/Image.html' },
]

const allowed = [
  { selector: '.c', owner: 'global container primitive' },
  { selector: '.w', owner: 'global wrap primitive' },
  { selector: '.btn', owner: 'button primitive may be global or component-owned' },
  { selector: '.btns', owner: 'button group primitive' },
  { selector: '.lnk', owner: 'link primitive may be global or component-owned' },
  { selector: '.lnks', owner: 'link group primitive' },
  { selector: '[g]', owner: 'grid container primitive' },
  { selector: '[c]', owner: 'grid column span primitive' },
  { selector: '[r]', owner: 'grid row span primitive' },
  { selector: '[o]', owner: 'grid order primitive' },
]

async function collectCssFiles(dir: string, base = ''): Promise<string[]> {
  const out: string[] = []
  let entries
  try { entries = await readdir(join(dir, base), { withFileTypes: true }) } catch { return out }
  for (const entry of entries) {
    const rel = base ? join(base, entry.name) : entry.name
    if (entry.isDirectory()) out.push(...await collectCssFiles(dir, rel))
    else if (entry.isFile() && entry.name.endsWith('.css')) out.push(join(dir, rel))
  }
  return out
}

function selectorRe(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[\\s,{])${escaped}(?=[\\s.#:[,{>])`, 'm')
}

const roots = new Set([await sourceStylesFile(), ...await collectCssFiles(await sourceStylesDir())])
const findings: { selector: string, owner: string, file: string }[] = []
for (const file of roots) {
  const css = await readFile(file, 'utf8').catch(() => '')
  for (const item of blocked) {
    if (selectorRe(item.selector).test(css)) findings.push({ ...item, file })
  }
}

console.log('CSS ownership audit')
console.log('Allowed primitives:')
for (const item of allowed) console.log(`- ${item.selector} — ${item.owner}`)

if (!findings.length) {
  console.log('\nNo component-owned selectors found in global CSS.')
  process.exit(0)
}

console.log('\nComponent-owned selectors in global CSS:')
for (const item of findings) console.log(`- ${item.selector} in ${item.file} → ${item.owner}`)
console.log('\nMove these into component <style> blocks or delete stale global rules.')
process.exit(1)
