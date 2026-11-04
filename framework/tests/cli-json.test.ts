import { afterEach, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

const cli = join(import.meta.dir, '../cli/sttc.ts')
const dirs: string[] = []
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }) })

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function diagnostics(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every((item: unknown) => record(item) && typeof item.message === 'string')
}
// Independent fixture consumer: never infer success from parseability or exit status alone.
function consume(stdout: string, code: number) {
  const value: unknown = JSON.parse(stdout)
  if (!stdout.endsWith('\n') || !record(value) || value.version !== 1 ||
    typeof value.command !== 'string' || !['build', 'check'].includes(value.command) ||
    typeof value.outcome !== 'string' || !['success', 'failure'].includes(value.outcome) ||
    !diagnostics(value.errors) || !value.errors.every(error => typeof error.name === 'string') || !diagnostics(value.warnings) ||
    (value.outcome === 'success') !== (value.errors.length === 0) ||
    (code === 0) !== (value.outcome === 'success')) throw new Error('Invalid command result')
  return value
}
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'sttc-json-'))
  dirs.push(dir)
  for (const path of ['components', 'pages', 'styles', 'images']) await mkdir(join(dir, 'src', path), { recursive: true })
  await writeFile(join(dir, 'src/site.json'), JSON.stringify({ name: 'JSON Fixture', url: 'https://fixture.test', description: 'Synthetic JSON protocol fixture.', locale: 'en' }))
  await writeFile(join(dir, 'src/shell.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><script src="/router.js" type="module"></script><script src="/assets/js/app.js" type="module"></script></head><body><main></main></body></html>')
  await writeFile(join(dir, 'src/pages/index.html'), '<h1>Fixture</h1>')
  await writeFile(join(dir, 'src/pages/404.html'), '<h1>Not found</h1>')
  await writeFile(join(dir, 'src/styles.css'), 'body{margin:0}')
  await writeFile(join(dir, 'src/app.ts'), 'export {}')
  return dir
}
async function run(dir: string, command: string, flags: string[] = []) {
  const proc = Bun.spawn(['bun', cli, command, '--json', ...flags], { cwd: dir, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
  expect(stdout.trim().split('\n')).toHaveLength(1)
  return { result: consume(stdout, code), code, stdout, stderr }
}

test('consumer accepts extensions and rejects malformed, unsupported, missing and truncated results', () => {
  const valid = { version: 1, command: 'build', outcome: 'success', errors: [], warnings: [] }
  expect(consume(JSON.stringify({ ...valid, future: true }) + '\n', 0).outcome).toBe('success')
  for (const value of [{ ...valid, version: 2 }, { ...valid, errors: 'none' }, { ...valid, warnings: [null] }, { ...valid, command: 1 }, { ...valid, command: ['build'] }, { ...valid, errors: [{ message: 'bad' }] }]) {
    expect(() => consume(JSON.stringify(value) + '\n', 0)).toThrow()
  }
  for (const text of ['', '{"version":1', JSON.stringify(valid), JSON.stringify(valid) + '\n{}\n']) expect(() => consume(text, 0)).toThrow()
  expect(() => consume(JSON.stringify(valid) + '\n', 1)).toThrow()
})

test('build and nested/skip-build check emit one success envelope with warnings and profiles', async () => {
  const dir = await fixture()
  const build = await run(dir, 'build')
  expect(build.code).toBe(0)
  expect(build.result.command).toBe('build')
  expect(build.result.warnings).toEqual([expect.objectContaining({ message: expect.stringContaining('no OG source') })])
  for (const flags of [[], ['--profile'], ['--skip-build'], ['--skip-build', '--profile']]) {
    const check = await run(dir, 'check', flags)
    expect(check.code).toBe(0)
    expect(check.result.command).toBe('check')
    if (flags.includes('--profile') && !flags.includes('--skip-build')) expect(check.result.profile).toEqual({ timings: expect.any(Object), totalMs: expect.any(Number) })
    else expect(check.result.profile).toBeUndefined()
  }
  await writeFile(join(dir, 'vercel.json'), '{')
  const warning = await run(dir, 'check', ['--skip-build'])
  expect(warning.code).toBe(0)
  expect(warning.result.warnings).toEqual([expect.objectContaining({ message: expect.stringContaining('vercel.json: invalid JSON') })])
  const doctor = await run(dir, 'doctor', ['--skip-build'])
  expect(doctor.code).toBe(0)
  expect(doctor.result.command).toBe('check')
})

test('cold image and OG conversion plus profile keep stdout parseable', async () => {
  const dir = await fixture()
  const image = Bun.file(join(import.meta.dir, '../../templates/default/src/images/og.png'))
  for (const name of ['hero', 'og']) await Bun.write(join(dir, `src/images/${name}.png`), image)
  const result = await run(dir, 'build', ['--profile'])
  expect(result.code).toBe(0)
  expect(result.result.profile).toEqual({ timings: expect.any(Object), totalMs: expect.any(Number) })
  expect(await Bun.file(join(dir, 'dist/assets/images/hero.webp')).exists()).toBe(true)
  expect(await Bun.file(join(dir, 'dist/assets/og.png')).exists()).toBe(true)
  const launch = await run(dir, 'check', ['--launch', '--allow-broken-links', '--profile'])
  expect(launch.code).toBe(1)
  expect(launch.stdout).toContain('placeholder')
})

test('malformed config and unexpected caught filesystem failures produce useful diagnostics', async () => {
  const dir = await fixture()
  await writeFile(join(dir, 'src/site.json'), '{ nope')
  for (const command of ['build', 'check']) {
    const result = await run(dir, command)
    expect(result.code).toBe(1)
    expect(result.result.errors).toEqual([expect.objectContaining({ name: 'BuildError', file: 'src/site.json', message: expect.any(String) })])
  }
  const unexpected = await fixture()
  await writeFile(join(unexpected, '.snz'), 'not a directory')
  for (const command of ['build', 'check']) {
    const result = await run(unexpected, command)
    expect(result.code).toBe(1)
    expect(result.result.errors).toEqual([expect.objectContaining({ name: expect.any(String), message: expect.stringMatching(/directory|EEXIST|ENOTDIR/) })])
    expect(result.stdout).not.toContain('"file"')
  }
})

test('broken links fail unless allowed, including skip-build and launch combinations', async () => {
  const dir = await fixture()
  await writeFile(join(dir, 'src/pages/index.html'), '<h1>Fixture</h1><a href="/missing/">Missing</a>')
  for (const command of ['build', 'check']) {
    expect((await run(dir, command)).code).toBe(1)
    expect((await run(dir, command, ['--allow-broken-links', '--profile'])).code).toBe(0)
  }
  const failure = await run(dir, 'check', ['--skip-build'])
  expect(failure.code).toBe(1)
  expect(failure.stdout).toContain('broken route /missing/')
  expect((await run(dir, 'check', ['--skip-build', '--allow-broken-links'])).code).toBe(0)
  // Launch retains its additional checks even when links are allowed.
  await writeFile(join(dir, 'src/site.json'), JSON.stringify({ name: 'Your Site', url: 'https://example.com', description: 'Fixture', locale: 'en' }))
  expect((await run(dir, 'check', ['--skip-build', '--allow-broken-links', '--launch'])).code).toBe(1)
})

test('skip-build catches unexpected checker errors without leaking a stack', async () => {
  const dir = await fixture()
  expect((await run(dir, 'build')).code).toBe(0)
  // A JSON null deploy config reaches the existing checker as an unexpected TypeError.
  await writeFile(join(dir, 'vercel.json'), 'null')
  const result = await run(dir, 'check', ['--skip-build', '--profile'])
  expect(result.code).toBe(1)
  expect(result.result.errors).toEqual([expect.objectContaining({ name: 'TypeError', message: expect.any(String) })])
  expect(result.stdout).not.toContain('"stack"')
})
