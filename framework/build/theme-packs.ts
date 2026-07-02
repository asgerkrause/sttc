import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { root } from './paths'

export const themePackNames = ['minimal', 'editorial', 'brutalist'] as const
export type ThemePackName = typeof themePackNames[number]

const themeStart = '/* snz-bp theme:start */'
const themeEnd = '/* snz-bp theme:end */'

const themePacks: Record<ThemePackName, string> = {
  minimal: `:root {
  --l-mw-max: 84;
  --s-py-max: 7;
  --s-py-min: 4;
  --s-px-max: 2;
  --s-px-min: 1;
  --s-gp-max: 1;
  --s-gp-min: 0.625;
  --s-pd-max: 1.4;
  --s-pd-min: 0.875;
  --s-br-max: 0.6;
  --s-br-min: 0.35;
  --s-ss-max: 3.6;
  --s-ss-min: 2.25;

  --t-ff-ss: Inter, ui-sans-serif, system-ui, sans-serif;
  --t-ff-se: ui-serif, Georgia, serif;
  --t-ff-mo: "SFMono-Regular", Consolas, monospace;
  --t-md-fw: var(--t-fw-r);
  --t-md-ls: -0.015em;
  --t-md-lh: 1.45;
  --t-md-mw: 68ch;

  --t-h0-fs-max: 7.2;
  --t-h1-fs-max: 5.6;
  --t-h2-fs-max: 3.8;
  --t-h3-fs-max: 2.6;
  --t-h4-fs-max: 2;
  --t-h0-ls: -0.035em;
  --t-h1-ls: -0.035em;
  --t-h2-ls: -0.025em;

  --c-light-fixed: #fff;
  --c-dark-fixed: #111;
  --c-acc: #245cff;
  --c-sec: #6855d9;
}`,
  editorial: `:root {
  --l-mw-max: 74;
  --s-py-max: 9;
  --s-py-min: 5;
  --s-px-max: 2.4;
  --s-px-min: 1;
  --s-gp-max: 1.4;
  --s-gp-min: 0.75;
  --s-pd-max: 1.8;
  --s-pd-min: 1;
  --s-br-max: 0.3;
  --s-br-min: 0.2;
  --s-ss-max: 5;
  --s-ss-min: 3;

  --t-ff-ss: Inter, ui-sans-serif, system-ui, sans-serif;
  --t-ff-se: Charter, "Iowan Old Style", Georgia, serif;
  --t-ff-mo: "SFMono-Regular", Consolas, monospace;
  --t-md-fw: var(--t-fw-r);
  --t-md-ls: -0.005em;
  --t-md-lh: 1.62;
  --t-md-mw: 72ch;

  --t-h0-ff: var(--t-ff-se);
  --t-h1-ff: var(--t-ff-se);
  --t-h2-ff: var(--t-ff-se);
  --t-h3-ff: var(--t-ff-se);
  --t-h0-fs-max: 8.8;
  --t-h1-fs-max: 6.8;
  --t-h2-fs-max: 4.4;
  --t-h3-fs-max: 3;
  --t-h4-fs-max: 2;
  --t-h0-ls: -0.045em;
  --t-h1-ls: -0.04em;
  --t-h2-ls: -0.025em;
  --t-h0-lh: 0.92;
  --t-h1-lh: 0.96;
  --t-h2-lh: 1.02;

  --c-light-fixed: #fff;
  --c-dark-fixed: #211;
  --c-acc: #9a3412;
  --c-sec: #365314;
}

body {
  font-variant-numeric: oldstyle-nums;
}`,
  brutalist: `:root {
  --l-mw-max: 90;
  --s-py-max: 6;
  --s-py-min: 3;
  --s-px-max: 1.6;
  --s-px-min: 0.75;
  --s-gp-max: 1.2;
  --s-gp-min: 0.6;
  --s-pd-max: 1.2;
  --s-pd-min: 0.75;
  --s-br-max: 0;
  --s-br-min: 0;
  --s-ss-max: 3;
  --s-ss-min: 2;
  --s-bw: 0.2rem;

  --t-ff-ss: Arial, Helvetica, sans-serif;
  --t-ff-se: Georgia, serif;
  --t-ff-mo: "SFMono-Regular", Consolas, monospace;
  --t-fw-r: 500;
  --t-fw-b: 800;
  --t-md-fw: var(--t-fw-r);
  --t-md-ls: -0.03em;
  --t-md-lh: 1.18;
  --t-md-mw: 60ch;

  --t-h0-fs-max: 9.6;
  --t-h1-fs-max: 7.2;
  --t-h2-fs-max: 4.8;
  --t-h3-fs-max: 3.2;
  --t-h4-fs-max: 2.2;
  --t-h0-fw: var(--t-fw-b);
  --t-h1-fw: var(--t-fw-b);
  --t-h2-fw: var(--t-fw-b);
  --t-h3-fw: var(--t-fw-b);
  --t-h0-ls: -0.07em;
  --t-h1-ls: -0.06em;
  --t-h2-ls: -0.045em;
  --t-h0-lh: 0.88;
  --t-h1-lh: 0.9;

  --c-light-fixed: #fff;
  --c-dark-fixed: #000;
  --c-acc: #d60000;
  --c-sec: #0047ff;
}

body {
  text-transform: none;
}`,
}

export function isThemePackName(name: string): name is ThemePackName {
  return themePackNames.includes(name as ThemePackName)
}

export function themePackContent(name: ThemePackName) {
  return `${themeStart}
/* ${name} token pack. Safe to edit after applying. */
${themePacks[name]}
${themeEnd}
`
}

function replaceThemeBlock(source: string, block: string) {
  const start = source.indexOf(themeStart)
  const end = source.indexOf(themeEnd)
  if (start === -1 && end === -1) {
    const trimmed = source.trimEnd()
    return trimmed ? `${trimmed}\n\n${block}` : block
  }
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Found incomplete snz-bp theme markers in src/styles.css. Remove both markers or restore block before retrying.`)
  }
  return `${source.slice(0, start)}${block.trimEnd()}${source.slice(end + themeEnd.length)}`
}

export async function applyThemePack(projectRoot: string, name: ThemePackName, options: { force?: boolean } = {}) {
  const stylesPath = join(projectRoot, 'src', 'styles.css')
  const file = Bun.file(stylesPath)
  const exists = await file.exists()
  const current = exists ? await readFile(stylesPath, 'utf8') : ''
  const hasTheme = current.includes(themeStart) || current.includes(themeEnd)

  if (hasTheme && !options.force) {
    throw new Error(`src/styles.css already has a snz-bp theme block. Pass --force to replace it.`)
  }

  const next = replaceThemeBlock(current, themePackContent(name))
  await mkdir(join(stylesPath, '..'), { recursive: true })
  await writeFile(stylesPath, next)
  return stylesPath
}

function usage(): never {
  console.error('Usage: snz-bp add theme <minimal|editorial|brutalist> [--force]')
  process.exit(1)
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const commandArgs = args[0] === 'add' ? args.slice(1) : args
  const type = commandArgs[0]
  const name = commandArgs[1]
  const force = args.includes('--force')

  if (type !== 'theme' || !name) usage()
  if (!isThemePackName(name)) {
    console.error(`unknown theme "${name}". Available: ${themePackNames.join(', ')}`)
    process.exit(1)
  }

  try {
    const path = await applyThemePack(root, name, { force })
    console.log(`applied ${name} theme to ${path}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(2)
  }
}
