#!/usr/bin/env bun
import { cp, mkdir, mkdtemp } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { platform, release, arch } from 'node:os'
import { createFixture, validateFixture } from './bench'

const repo = resolve(import.meta.dir, '../..')
const scratch = join(repo, '.snz/benchmarks/agent-tasks')

export async function prepareRepair() {
  await mkdir(scratch, { recursive: true })
  const root = await mkdtemp(join(scratch, 'repair-'))
  // createFixture deletes its target; only pass this newly allocated directory.
  await createFixture(root, 'routes', 2)
  const home = join(root, 'src/pages/index.html')
  await Bun.write(home, await Bun.file(home).text() + '\n<a href="/missing/">Read Page 1</a>\n')
  await Bun.write(join(root, 'src/styles.css'), ':root{font-family:system-ui;color:#172a39;background:#f6efe3}body{max-width:64rem;margin:auto;padding:3rem}article{padding:1rem;border-bottom:1px solid}a{font-weight:700}\n')
  return root
}

export async function inspectRepair(root: string) {
  const checks: { name: string; status: 'pass' | 'fail'; evidence: string }[] = []
  try {
    await validateFixture(root, 'routes', 2)
    checks.push({ name: 'baseline-output', status: 'pass', evidence: 'Two routes, Page 0/Page 1 headings and representations match fixture expectations.' })
  } catch (error) {
    checks.push({ name: 'baseline-output', status: 'fail', evidence: String(error) })
  }
  try {
    const html = await Bun.file(join(root, 'dist/index.html')).text()
    const links: { href: string | null; text: string }[] = []
    let current: { href: string | null; text: string } | undefined
    const parsed = new HTMLRewriter().on('a', {
      element(element) {
        current = { href: element.getAttribute('href'), text: '' }
        links.push(current)
      },
      text(chunk) { if (current) current.text += chunk.text },
    }).transform(new Response(html))
    await parsed.text()
    const candidates = links.filter(link => link.text.trim() === 'Read Page 1')
    const valid = candidates.length === 1 && candidates[0]?.href === '/page-0001/' && !html.includes('/missing/')
    const target = await Bun.file(join(root, 'dist/page-0001/index.html')).text()
    const targetValid = /<h1\b[^>]*>Page 1<\/h1>/.test(target)
    checks.push({ name: 'repair-link', status: valid && targetValid ? 'pass' : 'fail', evidence: JSON.stringify({ candidates, targetHeading: targetValid, staleLink: html.includes('/missing/') }) })
  } catch (error) {
    checks.push({ name: 'repair-link', status: 'fail', evidence: String(error) })
  }
  return checks
}

export async function gradeRepair(root: string, allowBrokenLinks = false) {
  const evidenceDir = await mkdtemp(join(root, 'evidence-'))
  await cp(join(root, 'src'), join(evidenceDir, 'src'), { recursive: true })
  for (const name of ['agent-eval.ts', 'bench.ts', 'agent-results.schema.json']) {
    await cp(join(import.meta.dir, name), join(evidenceDir, name))
  }
  const command = [process.execPath, join(repo, 'framework/build/index.ts'), ...(allowBrokenLinks ? ['--allow-broken-links'] : [])]
  const proc = Bun.spawn(command, { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
  await Bun.write(join(evidenceDir, 'stdout.txt'), stdout)
  await Bun.write(join(evidenceDir, 'stderr.txt'), stderr)
  if (await Bun.file(join(root, 'dist/index.html')).exists()) await cp(join(root, 'dist'), join(evidenceDir, 'dist'), { recursive: true })
  const checks = await inspectRepair(root)
  checks.unshift({ name: 'build', status: exitCode === 0 ? 'pass' : 'fail', evidence: JSON.stringify({ command, exitCode, stdout: 'stdout.txt', stderr: 'stderr.txt' }) })
  const packageInfo: unknown = await Bun.file(join(repo, 'package.json')).json()
  const stackVersion = packageInfo && typeof packageInfo === 'object' && 'version' in packageInfo && typeof packageInfo.version === 'string' ? packageInfo.version : null
  const revision = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: repo })
  const diff = Bun.spawnSync(['git', 'diff', '--', 'framework'], { cwd: repo })
  await Bun.write(join(evidenceDir, 'framework.diff'), diff.stdout)
  const result = {
    schemaVersion: 1, protocol: 'agent-tasks-v1', kind: 'grader-validation',
    stack: 'sttc', task: 'broken-link', trial: null, recordedAt: new Date().toISOString(),
    revision: revision.exitCode === 0 ? revision.stdout.toString().trim() : null,
    versions: { stack: stackVersion, bun: Bun.version, os: `${platform()} ${release()} ${arch()}` },
    settings: { model: null, reasoning: null, serviceTier: null, harness: null, tools: [], docs: [], prompt: null, order: null, budgetSeconds: null, budgetToolCalls: null, spendLimit: null },
    outcome: checks.every(check => check.status === 'pass') ? 'pass' : 'fail', checks,
    interventions: { rescues: 0, humanCorrections: 0, notes: 'Deterministic grader invocation; no agent attempt. Source repair between records is test setup.' },
    humanReview: { design: 'not-run', content: 'not-run', notes: null },
    effort: { agentSeconds: null, toolCalls: null, inputTokens: null, outputTokens: null, cost: null, currency: null, reviewSeconds: null, correctionSeconds: null, correctionOutcome: 'not-run' },
    evidence: [evidenceDir], notes: allowBrokenLinks ? 'Seed generation bypasses built-in link check to challenge independent artifact grader.' : 'Normal build plus independent artifact checks. Not AI productivity evidence.',
  }
  await Bun.write(join(evidenceDir, 'result.json'), JSON.stringify(result, null, 2) + '\n')
  return { result, evidenceDir }
}

if (import.meta.main) {
  const [command, root] = process.argv.slice(2)
  if (command === 'prepare') console.log(await prepareRepair())
  else if (command === 'grade' && root) {
    const grade = await gradeRepair(resolve(root))
    console.log(join(grade.evidenceDir, 'result.json'))
    process.exitCode = grade.result.outcome === 'pass' ? 0 : 1
  } else throw new Error('Usage: bun framework/benchmarks/agent-eval.ts prepare | grade <fixture>')
}
