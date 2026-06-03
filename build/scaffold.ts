// CLI: bun run new <kind> <name> [--force] [--demo]
// kind: component | route | post | page
// route writes src/pages/*.html. page remains CMS content page.
//
// Writes the minimum viable shape for each. Refuses to overwrite without --force.

import { mkdir, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { root } from './paths'

type Kind = 'component' | 'route' | 'post' | 'page'

const args = process.argv.slice(2)
const kind = args[0] as Kind | undefined
const name = args[1]
const force = args.includes('--force')
const demo = args.includes('--demo')

function usage(): never {
  console.error('Usage: bun run new <component|route|post|page> <name> [--force] [--demo]')
  process.exit(1)
}

if (!kind || !name) usage()
if (!['component', 'route', 'post', 'page'].includes(kind)) usage()

async function exists(p: string) {
  try { await stat(p); return true } catch { return false }
}

async function writeIfMissing(path: string, content: string) {
  if (await exists(path) && !force) {
    console.error(`refusing to overwrite ${path} (pass --force to overwrite)`)
    process.exit(2)
  }
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, content)
  console.log(`wrote ${path}`)
}

const today = new Date().toISOString().slice(0, 10)

if (kind === 'component') {
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) {
    console.error(`component name must be PascalCase (got "${name}")`)
    process.exit(1)
  }
  const html = `<!--
  @desc ${name} — TODO describe what this component does.
  @attr title! Heading text.
-->
<article class="${name.toLowerCase()}">
  <h2>{{title}}</h2>
  <div>{{slot}}</div>
</article>

<style>
  .${name.toLowerCase()} {
    /* use tokens from src/styles/styles.css; prefer elements/attrs before extra classes */
  }
</style>
`
  await writeIfMissing(join(root, 'src', 'components', `${name}.html`), html)
  if (demo) {
    const stylesPath = (await exists(join(root, 'src', 'pages', 'styles.html')))
      ? join(root, 'src', 'pages', 'styles.html')
      : join(root, 'src', 'routes', 'styles.html')
    if (await exists(stylesPath)) {
      const append = `\n<section><div class="c"><${name} title="${name} demo">Demo content.</${name}></div></section>\n`
      const cur = await Bun.file(stylesPath).text()
      await writeFile(stylesPath, cur + append)
      console.log(`appended demo to ${stylesPath}`)
    }
  }
} else if (kind === 'route') {
  if (!/^[a-z][a-z0-9-/]*$/.test(name) || name.includes('//') || name.endsWith('/')) {
    console.error(`route slug must be kebab-case path (got "${name}")`)
    process.exit(1)
  }
  const html = `<head>
  <SEO title="${name[0].toUpperCase() + name.slice(1)}" description="..." />
</head>

<Section>
  <h1>${name[0].toUpperCase() + name.slice(1)}</h1>
  <p>Route body.</p>
</Section>
`
  await writeIfMissing(join(root, 'src', 'pages', `${name}.html`), html)
} else if (kind === 'post' || kind === 'page') {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    console.error(`${kind} slug must be kebab-case (got "${name}")`)
    process.exit(1)
  }
  const dir = kind === 'post' ? 'posts' : 'pages'
  const md = `---
title: ${name.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')}
date: ${today}
description: TODO
${kind === 'post' ? 'tags: []\n' : ''}---

Write here.
`
  await writeIfMissing(join(root, 'content', dir, `${name}.md`), md)
}
