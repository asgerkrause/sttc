import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { applyThemePack, isThemePackName, themePackContent, themePackNames } from '../build/theme-packs'

async function tempProject() {
  const dir = await mkdtemp(join(tmpdir(), 'snz-bp-theme-'))
  await mkdir(join(dir, 'src'), { recursive: true })
  return dir
}

describe('theme packs', () => {
  test('exposes expected private starter theme names', () => {
    expect(themePackNames).toEqual(['minimal', 'editorial', 'brutalist'])
    expect(isThemePackName('minimal')).toBe(true)
    expect(isThemePackName('unknown')).toBe(false)
  })

  test('renders owned CSS token block for each theme', () => {
    for (const name of themePackNames) {
      const css = themePackContent(name)

      expect(css).toContain('/* snz-bp theme:start */')
      expect(css).toContain(`/* ${name} token pack. Safe to edit after applying. */`)
      expect(css).toContain(':root {')
      expect(css).toContain('--a:')
      expect(css).toContain('/* snz-bp theme:end */')
      expect(css).not.toContain('.card')
      expect(css).not.toContain('.accordion')
    }
  })

  test('appends theme block without overwriting existing styles', async () => {
    const dir = await tempProject()
    try {
      const stylesPath = join(dir, 'src', 'styles.css')
      await writeFile(stylesPath, '@import "grid.css";\n\nbody { color: var(--i); }\n')

      await applyThemePack(dir, 'editorial')

      const css = await readFile(stylesPath, 'utf8')
      expect(css.startsWith('@import "grid.css";\n\nbody { color: var(--i); }')).toBe(true)
      expect(css).toContain('/* editorial token pack. Safe to edit after applying. */')
      expect(css).toContain('--ff: var(--ff-serif);')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('refuses to replace existing theme block without force', async () => {
    const dir = await tempProject()
    try {
      await applyThemePack(dir, 'minimal')

      await expect(applyThemePack(dir, 'brutalist')).rejects.toThrow('Pass --force to replace it')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('replaces existing theme block with force', async () => {
    const dir = await tempProject()
    try {
      await applyThemePack(dir, 'minimal')
      await applyThemePack(dir, 'brutalist', { force: true })

      const css = await readFile(join(dir, 'src', 'styles.css'), 'utf8')
      expect(css).toContain('/* brutalist token pack. Safe to edit after applying. */')
      expect(css).toContain('--bw: 0.2rem;')
      expect(css).not.toContain('/* minimal token pack. Safe to edit after applying. */')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
