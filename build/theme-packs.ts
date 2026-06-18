import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { root } from './paths'

export const themePackNames = ['minimal', 'editorial', 'brutalist'] as const
export type ThemePackName = typeof themePackNames[number]

const themeStart = '/* snz-bp theme:start */'
const themeEnd = '/* snz-bp theme:end */'

const themePacks: Record<ThemePackName, string> = {
  minimal: `:root {
  --mw: 168rem;
  --by: 7rem;
  --bx: 2rem;
  --gp: 1rem;
  --pd: 1.4rem;
  --br: 0.6rem;
  --ss: 3.6rem;

  --ff: var(--ff-sans);
  --ff-sans: Inter, ui-sans-serif, system-ui, sans-serif;
  --ff-serif: ui-serif, Georgia, serif;
  --ff-mono: "SFMono-Regular", Consolas, monospace;
  --fs: 1.6rem;
  --fw: 400;
  --ls: -0.015em;
  --lh: 1.45;
  --fmw: 68ch;

  --h0-fs: 7.2rem;
  --h1-fs: 5.6rem;
  --h2-fs: 3.8rem;
  --h3-fs: 2.6rem;
  --h4-fs: 2rem;
  --h0-ls: -0.035em;
  --h1-ls: -0.035em;
  --h2-ls: -0.025em;

  --li: hsl(40 24% 98%);
  --da: hsl(220 14% 10%);
  --a: #245cff;
  --c: #6855d9;
}

body {
  background: var(--s);
}`,
  editorial: `:root {
  --mw: 148rem;
  --by: 9rem;
  --bx: 2.4rem;
  --gp: 1.4rem;
  --pd: 1.8rem;
  --br: 0.3rem;
  --ss: 5rem;

  --ff: var(--ff-serif);
  --ff-sans: Inter, ui-sans-serif, system-ui, sans-serif;
  --ff-serif: Charter, "Iowan Old Style", Georgia, serif;
  --ff-mono: "SFMono-Regular", Consolas, monospace;
  --fs: 1.9rem;
  --fw: 400;
  --ls: -0.005em;
  --lh: 1.62;
  --fmw: 72ch;

  --h0-ff: var(--ff-serif);
  --h1-ff: var(--ff-serif);
  --h2-ff: var(--ff-serif);
  --h3-ff: var(--ff-serif);
  --h0-fs: 8.8rem;
  --h1-fs: 6.8rem;
  --h2-fs: 4.4rem;
  --h3-fs: 3rem;
  --h4-fs: 2rem;
  --h0-ls: -0.045em;
  --h1-ls: -0.04em;
  --h2-ls: -0.025em;
  --h0-lh: 0.92;
  --h1-lh: 0.96;
  --h2-lh: 1.02;

  --li: hsl(43 35% 96%);
  --da: hsl(28 18% 11%);
  --a: #9a3412;
  --c: #365314;
}

body {
  font-variant-numeric: oldstyle-nums;
}`,
  brutalist: `:root {
  --mw: 180rem;
  --by: 6rem;
  --bx: 1.6rem;
  --gp: 1.2rem;
  --pd: 1.2rem;
  --br: 0;
  --ss: 3rem;
  --bw: 0.2rem;

  --ff: var(--ff-sans);
  --ff-sans: Arial, Helvetica, sans-serif;
  --ff-serif: Georgia, serif;
  --ff-mono: "SFMono-Regular", Consolas, monospace;
  --fs: 1.8rem;
  --fw: 500;
  --ls: -0.03em;
  --lh: 1.18;
  --fmw: 60ch;

  --h0-fs: 9.6rem;
  --h1-fs: 7.2rem;
  --h2-fs: 4.8rem;
  --h3-fs: 3.2rem;
  --h4-fs: 2.2rem;
  --h0-fw: 800;
  --h1-fw: 800;
  --h2-fw: 800;
  --h3-fw: 800;
  --h0-ls: -0.07em;
  --h1-ls: -0.06em;
  --h2-ls: -0.045em;
  --h0-lh: 0.88;
  --h1-lh: 0.9;

  --li: hsl(58 100% 96%);
  --da: hsl(0 0% 0%);
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
