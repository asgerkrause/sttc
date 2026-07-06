import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { sourceStylesDir, sourceStylesFile, src } from './paths'

const blocked = [
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
  { selector: '.crd', owner: 'global card primitive' },
  { selector: '.btn', owner: 'button primitive may be global or component-owned' },
  { selector: '.btns', owner: 'button group primitive' },
  { selector: '.lnk', owner: 'link primitive may be global or component-owned' },
  { selector: '.lnks', owner: 'link group primitive' },
  { selector: '[g]', owner: 'grid container primitive' },
  { selector: '[c]', owner: 'grid column span primitive' },
  { selector: '[r]', owner: 'grid row span primitive' },
  { selector: '[o]', owner: 'grid order primitive' },
]

async function collectFiles(dir: string, extensions: string[], base = ''): Promise<string[]> {
  const out: string[] = []
  let entries
  try { entries = await readdir(join(dir, base), { withFileTypes: true }) } catch { return out }
  for (const entry of entries) {
    const rel = base ? join(base, entry.name) : entry.name
    if (entry.isDirectory()) out.push(...await collectFiles(dir, extensions, rel))
    else if (entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension))) out.push(join(dir, rel))
  }
  return out
}

function selectorRe(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[\\s,{])${escaped}(?=[\\s.#:[,{>])`, 'm')
}

const roots = new Set([await sourceStylesFile(), ...await collectFiles(await sourceStylesDir(), ['.css'])])
const findings: { selector: string, owner: string, file: string }[] = []
for (const file of roots) {
  const css = await readFile(file, 'utf8').catch(() => '')
  for (const item of blocked) {
    if (selectorRe(item.selector).test(css)) findings.push({ ...item, file })
  }
}

const craftDrift = [
  { pattern: /\bf-(lg|md|sm)\b|\.f-(lg|md|sm)\b/, message: 'use .t-lg/.t-md/.t-sm type utilities' },
  { pattern: /\bc-(i|g|s|a|c)\b|\.c-(i|g|s|a|c)\b/, message: 'use .c-ink/.c-mut/.c-bg/.c-acc/.c-sec color utilities' },
  { pattern: /data-accent=/, message: 'use data-theme="accent" or data-theme="secondary" instead of data-accent' },
  { pattern: /--l-z-head\b/, message: 'use stack token --z-head' },
  { pattern: /\blh-(min|max)\b|--t-[\w-]+-lh:\s*clamp\(|line-height:\s*clamp\(/, message: 'line-height tokens are fixed values; never use lh-min/lh-max or clamp() for line-height' },
  { pattern: /@attr color=|<(Button|Submit)\b[^>]*\scolor=/, message: 'use variant attr for Button/Submit visual treatment' },
  { pattern: /<Card\b[^>]*\stheme=|@desc Flexible styled container[\s\S]*@attr theme=/, message: 'use Card variant attr; theme is for scoped data-theme components' },
]
const driftFindings: { file: string, message: string }[] = []
for (const file of await collectFiles(src, ['.css', '.html', '.ts', '.js'])) {
  const text = await readFile(file, 'utf8').catch(() => '')
  for (const item of craftDrift) {
    if (item.pattern.test(text)) driftFindings.push({ file, message: item.message })
  }
}

console.log('CSS ownership audit')
console.log('Allowed primitives:')
for (const item of allowed) console.log(`- ${item.selector} — ${item.owner}`)

if (!findings.length && !driftFindings.length) {
  console.log('\nNo component-owned selectors or Craft vocabulary drift found in source CSS/HTML/JS.')
  process.exit(0)
}

if (findings.length) {
  console.log('\nComponent-owned selectors in global CSS:')
  for (const item of findings) console.log(`- ${item.selector} in ${item.file} → ${item.owner}`)
  console.log('\nMove these into component <style> blocks or delete stale global rules.')
}

if (driftFindings.length) {
  console.log('\nCraft vocabulary drift:')
  for (const item of driftFindings) console.log(`- ${item.file} → ${item.message}`)
}
process.exit(1)
