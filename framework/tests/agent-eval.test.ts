import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { gradeRepair, inspectRepair, prepareRepair } from '../benchmarks/agent-eval'
import schema from '../benchmarks/agent-results.schema.json'

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Only the vocabulary used by this schema; fail closed if it grows.
function validate(value: unknown, rule: unknown): boolean {
  if (!record(rule)) throw new Error('Invalid schema node')
  const supported = ['$schema', 'title', 'description', 'type', 'required', 'additionalProperties', 'properties', 'items', 'enum', 'const', 'minimum', 'minLength']
  if (Object.keys(rule).some(key => !supported.includes(key))) throw new Error('Unsupported schema keyword')
  if ('const' in rule && value !== rule.const) return false
  if (Array.isArray(rule.enum) && !rule.enum.includes(value)) return false
  if (rule.type) {
    const types = Array.isArray(rule.type) ? rule.type : [rule.type]
    if (!types.some(type => type === 'null' ? value === null : type === 'integer' ? typeof value === 'number' && Number.isInteger(value) : type === 'object' ? record(value) : type === 'array' ? Array.isArray(value) : typeof value === type)) return false
  }
  if (typeof value === 'number' && (!Number.isFinite(value) || typeof rule.minimum === 'number' && value < rule.minimum)) return false
  if (typeof value === 'string' && typeof rule.minLength === 'number' && value.length < rule.minLength) return false
  if (Array.isArray(value) && rule.items && !value.every(item => validate(item, rule.items))) return false
  if (record(value) && record(rule.properties)) {
    const properties = rule.properties
    if (Array.isArray(rule.required) && rule.required.some(key => typeof key !== 'string' || !(key in value))) return false
    if (rule.additionalProperties === false && Object.keys(value).some(key => !(key in properties))) return false
    if (!Object.entries(value).every(([key, child]) => !(key in properties) || validate(child, properties[key]))) return false
  }
  return true
}

test('real build artifacts reject styled broken link, retain failure, and accept source repair', async () => {
  const root = await prepareRepair()
  const bad = await gradeRepair(root, true)
  expect(bad.result.checks.find(check => check.name === 'build')?.status).toBe('pass')
  expect(bad.result.checks.find(check => check.name === 'repair-link')?.status).toBe('fail')
  expect(bad.result.outcome).toBe('fail')
  const strictBad = await gradeRepair(root)
  expect(strictBad.result.checks.find(check => check.name === 'build')?.status).toBe('fail')
  const source = join(root, 'src/pages/index.html')
  await Bun.write(source, (await Bun.file(source).text()).replace('href="/missing/"', 'href="/page-0001/"'))
  const good = await gradeRepair(root)
  expect(good.result.outcome).toBe('pass')
  expect(good.result.checks.every(check => check.status === 'pass')).toBe(true)
  expect(await Bun.file(join(bad.evidenceDir, 'dist/index.html')).text()).toContain('href="/missing/"')
  expect(await Bun.file(join(bad.evidenceDir, 'result.json')).json()).toEqual(bad.result)
  expect(await Bun.file(join(strictBad.evidenceDir, 'result.json')).json()).toEqual(strictBad.result)
  expect(validate(good.result, schema)).toBe(true)
  expect(validate(bad.result, schema)).toBe(true)
  expect(validate({ ...good.result, outcome: 'success' }, schema)).toBe(false)
  expect(validate({ ...good.result, effort: { ...good.result.effort, cost: -1 } }, schema)).toBe(false)
  expect(validate({ ...good.result, interventions: { rescues: 'zero' } }, schema)).toBe(false)
  expect(validate({ ...good.result, checks: [{ name: 'fake', status: true }] }, schema)).toBe(false)
  expect(validate({ schemaVersion: 1 }, schema)).toBe(false)
  expect(validate(null, schema)).toBe(false)
  expect(() => validate({}, { unsupported: true })).toThrow('Unsupported')
  expect(() => JSON.parse('{"outcome":')).toThrow()
  console.log(`Grader validation evidence (not agent trials): ${root}`)
}, 60_000)

test('missing output cannot pass artifact acceptance', async () => {
  const root = await prepareRepair()
  expect((await inspectRepair(root)).every(check => check.status === 'fail')).toBe(true)
})
