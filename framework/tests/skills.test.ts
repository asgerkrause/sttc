import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { syncSkills } from '../build/skills'

const repoRoot = join(import.meta.dir, '..', '..')
const canonicalRoot = join(repoRoot, 'templates', 'default', '.agents', 'skills')
const skillNames = ['snz-collection', 'snz-component', 'snz-diagnose', 'snz-launch']

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'snz-skills-'))
  const sourceRoot = join(root, 'source')
  const projectRoot = join(root, 'project')
  await mkdir(join(sourceRoot, 'snz-component'), { recursive: true })
  await mkdir(projectRoot, { recursive: true })
  return { root, sourceRoot, projectRoot }
}

async function writeManagedSkill(root: string, body: string) {
  const frontmatter = '---\nname: snz-component\ndescription: Use when testing component sync.\n---\n'
  const hash = new Bun.CryptoHasher('sha256').update(`${frontmatter}${body}`).digest('hex')
  const content = `${frontmatter}<!-- @snz-skill snz-component ${hash} -->\n${body}`
  await writeFile(join(root, 'snz-component', 'SKILL.md'), content)
  return content
}

describe('skill synchronization', () => {
  test('creates missing skills and is byte-stable on a second sync', async () => {
    const { root, sourceRoot, projectRoot } = await fixture()
    try {
      const expected = await writeManagedSkill(sourceRoot, '# Component\n')

      const first = await syncSkills({ sourceRoot, projectRoot })
      const second = await syncSkills({ sourceRoot, projectRoot })

      expect(first).toMatchObject({ code: 0, created: ['snz-component'], conflicts: [] })
      expect(second).toMatchObject({ code: 0, unchanged: ['snz-component'], conflicts: [] })
      expect(await readFile(join(projectRoot, '.agents', 'skills', 'snz-component', 'SKILL.md'), 'utf8')).toBe(expected)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('updates an unmodified managed skill', async () => {
    const { root, sourceRoot, projectRoot } = await fixture()
    try {
      const destination = join(projectRoot, '.agents', 'skills', 'snz-component')
      await mkdir(destination, { recursive: true })
      await writeManagedSkill(sourceRoot, '# Component v2\n')
      await writeManagedSkill(join(projectRoot, '.agents', 'skills'), '# Component v1\n')

      const result = await syncSkills({ sourceRoot, projectRoot })

      expect(result).toMatchObject({ code: 0, updated: ['snz-component'], conflicts: [] })
      expect(await readFile(join(destination, 'SKILL.md'), 'utf8')).toContain('# Component v2')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('reports every collision and writes nothing', async () => {
    const { root, sourceRoot, projectRoot } = await fixture()
    try {
      await writeManagedSkill(sourceRoot, '# Component v2\n')
      await mkdir(join(sourceRoot, 'snz-launch'), { recursive: true })
      const launchBody = '# Launch\n'
      const launchFrontmatter = '---\nname: snz-launch\ndescription: Use when testing launch sync.\n---\n'
      const launchHash = new Bun.CryptoHasher('sha256').update(`${launchFrontmatter}${launchBody}`).digest('hex')
      await writeFile(join(sourceRoot, 'snz-launch', 'SKILL.md'), `${launchFrontmatter}<!-- @snz-skill snz-launch ${launchHash} -->\n${launchBody}`)

      const componentDestination = join(projectRoot, '.agents', 'skills', 'snz-component')
      await mkdir(componentDestination, { recursive: true })
      await writeFile(join(componentDestination, 'SKILL.md'), '# User owned\n')

      const result = await syncSkills({ sourceRoot, projectRoot })

      expect(result.code).toBe(2)
      expect(result.conflicts).toEqual(['snz-component'])
      expect(await Bun.file(join(projectRoot, '.agents', 'skills', 'snz-launch', 'SKILL.md')).exists()).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('--check reports drift without writing', async () => {
    const { root, sourceRoot, projectRoot } = await fixture()
    try {
      await writeManagedSkill(sourceRoot, '# Component\n')

      const result = await syncSkills({ sourceRoot, projectRoot, check: true })

      expect(result).toMatchObject({ code: 1, missing: ['snz-component'] })
      expect(await Bun.file(join(projectRoot, '.agents', 'skills', 'snz-component', 'SKILL.md')).exists()).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('rethrows non-missing destination read errors before writing', async () => {
    const { root, sourceRoot, projectRoot } = await fixture()
    try {
      await writeManagedSkill(sourceRoot, '# Component\n')
      await mkdir(join(sourceRoot, 'snz-launch'), { recursive: true })
      const launchBody = '# Launch\n'
      const launchFrontmatter = '---\nname: snz-launch\ndescription: Use when testing launch sync.\n---\n'
      const launchHash = new Bun.CryptoHasher('sha256').update(`${launchFrontmatter}${launchBody}`).digest('hex')
      await writeFile(join(sourceRoot, 'snz-launch', 'SKILL.md'), `${launchFrontmatter}<!-- @snz-skill snz-launch ${launchHash} -->\n${launchBody}`)
      await mkdir(join(projectRoot, '.agents', 'skills', 'snz-launch', 'SKILL.md'), { recursive: true })

      await expect(syncSkills({ sourceRoot, projectRoot })).rejects.toThrow()
      expect(await Bun.file(join(projectRoot, '.agents', 'skills', 'snz-component', 'SKILL.md')).exists()).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('canonical SANITIZE skills', () => {
  test('ship four valid managed Agent Skills packages', async () => {
    expect((await readdir(canonicalRoot)).sort()).toEqual(skillNames)

    for (const name of skillNames) {
      const content = await readFile(join(canonicalRoot, name, 'SKILL.md'), 'utf8')
      expect(content.startsWith('---\n')).toBe(true)
      const marker = content.match(/<!-- @snz-skill ([a-z0-9-]+) ([a-f0-9]{64}) -->\n/)
      if (!marker) throw new Error(`${name} is missing its managed marker`)
      expect(marker?.[1]).toBe(name)
      const body = content.replace(marker[0], '')
      expect(new Bun.CryptoHasher('sha256').update(body).digest('hex')).toBe(marker[2])
      expect(body).toContain(`name: ${name}`)
      expect(body).toMatch(/description: Use when /)
      expect(body).not.toMatch(/\bnpm\b/i)
    }
  })

  test('starter exposes explicit skill synchronization', async () => {
    const pkg = JSON.parse(await readFile(join(repoRoot, 'templates', 'default', 'package.json'), 'utf8'))
    expect(pkg.scripts.skills).toBe('snz-bp skills')
  })
})
