import { readFile } from 'fs/promises'
import { sourceStylesFile } from './paths'

const stylesPath = await sourceStylesFile()

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

function selectorRe(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[\\s,{])${escaped}(?=[\\s.#:[,{>])`, 'm')
}

const css = await readFile(stylesPath, 'utf8')
const findings = blocked.filter(({ selector }) => selectorRe(selector).test(css))

console.log('CSS ownership audit')
console.log('Allowed primitives:')
for (const item of allowed) console.log(`- ${item.selector} — ${item.owner}`)

if (!findings.length) {
  console.log('\nNo component-owned selectors found in styles.css.')
  process.exit(0)
}

console.log('\nComponent-owned selectors in styles.css:')
for (const item of findings) console.log(`- ${item.selector} → ${item.owner}`)
console.log('\nMove these into component <style> blocks or delete stale global rules.')
