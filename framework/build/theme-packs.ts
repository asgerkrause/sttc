import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { root } from './paths'

export const themePackNames = ['minimal', 'editorial', 'brutalist'] as const
export type ThemePackName = typeof themePackNames[number]

const themeStart = '/* snz-bp theme:start */'
const themeEnd = '/* snz-bp theme:end */'

const themePacks: Record<ThemePackName, string> = {
  minimal: `:root {
  --mw-max: 84;
  --py-max: 7;
  --py-min: 4;
  --px-max: 2;
  --px-min: 1;
  --gp-max: 1;
  --gp-min: 0.625;
  --pd-max: 1.4;
  --pd-min: 0.875;
  --br-max: 0.6;
  --br-min: 0.35;
  --ss-max: 3.6;
  --ss-min: 2.25;

  --ff-sans: Inter, ui-sans-serif, system-ui, sans-serif;
  --ff-serif: ui-serif, Georgia, serif;
  --ff-mono: "SFMono-Regular", Consolas, monospace;
  --md-fw: var(--fw-r);
  --md-ls: -0.015em;
  --md-lh: 1.45;
  --md-mw: 68ch;

  --h0-max: 7.2;
  --h1-max: 5.6;
  --h2-max: 3.8;
  --h3-max: 2.6;
  --h4-max: 2;
  --h0-ls: -0.035em;
  --h1-ls: -0.035em;
  --h2-ls: -0.025em;

  --l: #fff;
  --d: #111;
  --a: #245cff;
  --c: #6855d9;
}`,
  editorial: `:root {
  --mw-max: 74;
  --py-max: 9;
  --py-min: 5;
  --px-max: 2.4;
  --px-min: 1;
  --gp-max: 1.4;
  --gp-min: 0.75;
  --pd-max: 1.8;
  --pd-min: 1;
  --br-max: 0.3;
  --br-min: 0.2;
  --ss-max: 5;
  --ss-min: 3;

  --ff-sans: Inter, ui-sans-serif, system-ui, sans-serif;
  --ff-serif: Charter, "Iowan Old Style", Georgia, serif;
  --ff-mono: "SFMono-Regular", Consolas, monospace;
  --md-fw: var(--fw-r);
  --md-ls: -0.005em;
  --md-lh: 1.62;
  --md-mw: 72ch;

  --h0-ff: var(--ff-serif);
  --h1-ff: var(--ff-serif);
  --h2-ff: var(--ff-serif);
  --h3-ff: var(--ff-serif);
  --h0-max: 8.8;
  --h1-max: 6.8;
  --h2-max: 4.4;
  --h3-max: 3;
  --h4-max: 2;
  --h0-ls: -0.045em;
  --h1-ls: -0.04em;
  --h2-ls: -0.025em;
  --h0-lh: 0.92;
  --h1-lh: 0.96;
  --h2-lh: 1.02;

  --l: #fff;
  --d: #211;
  --a: #9a3412;
  --c: #365314;
}

body {
  font-variant-numeric: oldstyle-nums;
}`,
  brutalist: `:root {
  --mw-max: 90;
  --py-max: 6;
  --py-min: 3;
  --px-max: 1.6;
  --px-min: 0.75;
  --gp-max: 1.2;
  --gp-min: 0.6;
  --pd-max: 1.2;
  --pd-min: 0.75;
  --br-max: 0;
  --br-min: 0;
  --ss-max: 3;
  --ss-min: 2;
  --bw: 0.2rem;

  --ff-sans: Arial, Helvetica, sans-serif;
  --ff-serif: Georgia, serif;
  --ff-mono: "SFMono-Regular", Consolas, monospace;
  --fw-r: 500;
  --fw-b: 800;
  --md-fw: var(--fw-r);
  --md-ls: -0.03em;
  --md-lh: 1.18;
  --md-mw: 60ch;

  --h0-max: 9.6;
  --h1-max: 7.2;
  --h2-max: 4.8;
  --h3-max: 3.2;
  --h4-max: 2.2;
  --h0-fw: var(--fw-b);
  --h1-fw: var(--fw-b);
  --h2-fw: var(--fw-b);
  --h3-fw: var(--fw-b);
  --h0-ls: -0.07em;
  --h1-ls: -0.06em;
  --h2-ls: -0.045em;
  --h0-lh: 0.88;
  --h1-lh: 0.9;

  --l: #fff;
  --d: #000;
  --a: #d60000;
  --c: #0047ff;
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
