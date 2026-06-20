// CLI: bun run new <kind> <name> [--force] [--demo]
//      bun run new collection <name> [--route <pattern>] [--template <name>] [--label <label>] [--force]
// kind: component | route | post | page | cms | collection
// route writes src/pages/*.html. page remains CMS content page. cms has no name.
// collection writes config/folder/template/editor scaffold; compiler owns compile.
//
// Writes the minimum viable shape for each. Refuses to overwrite without --force.

import { mkdir, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { root } from './paths'

type Kind = 'component' | 'route' | 'post' | 'page' | 'cms' | 'collection'
const args = process.argv.slice(2)
const kind = args[0] as Kind | undefined
const name = args[1]
const force = args.includes('--force')
const demo = args.includes('--demo')

function usage(): never {
  console.error('Usage: bun run new <component|route|post|page> <name> [--force] [--demo]')
  console.error('       bun run new cms [--force]')
  console.error('       bun run new collection <name> [--route <pattern>] [--template <name>] [--label <label>] [--force]')
  process.exit(1)
}

if (!kind) usage()
if (!['component', 'route', 'post', 'page', 'cms', 'collection'].includes(kind)) usage()
if (kind !== 'cms' && !name) usage()

const requiredName = name ?? ''

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

function optionValue(flag: string) {
  const i = args.indexOf(flag)
  if (i === -1) return undefined
  const value = args[i + 1]
  if (!value || value.startsWith('--')) {
    console.error(`${flag} requires a value`)
    process.exit(1)
  }
  return value
}

function titleize(value: string) {
  return value.split('-').filter(Boolean).map((w) => `${w[0]?.toUpperCase() ?? ''}${w.slice(1)}`).join(' ')
}

function singularize(value: string) {
  if (value.endsWith('ies')) return `${value.slice(0, -3)}y`
  if (value.endsWith('s')) return value.slice(0, -1)
  return value
}

function validateCollectionName(value: string) {
  if (/^[a-z][a-z0-9-]*$/.test(value) && value !== 'posts' && value !== 'pages') return
  console.error(`collection name must be a lowercase id and not posts/pages (got "${value}")`)
  process.exit(1)
}

function validateCollectionRoute(value: string) {
  const route = value.replace(/^\/+|\/+$/g, '')
  const tokenCount = route.match(/\{slug\}/g)?.length ?? 0
  if (tokenCount !== 1) {
    console.error('collection route must contain exactly one {slug} token')
    process.exit(1)
  }
  for (const part of route.split('/')) {
    if (part === '{slug}') continue
    if (/^[a-z0-9][a-z0-9-]*$/.test(part)) continue
    console.error('collection route segments must be lowercase URL-safe literals or {slug}')
    process.exit(1)
  }
  return route
}

function validateTemplateName(value: string) {
  const template = value.endsWith('.html') ? value : `${value}.html`
  if (!template.includes('/') && !template.includes('\\') && !template.includes('..') && /^[a-z][a-z0-9-]*\.html$/.test(template)) return template
  console.error('collection template must be a lowercase .html filename in src/templates/')
  process.exit(1)
}

const today = new Date().toISOString().slice(0, 10)

const pagesYml = `# Pages CMS — https://pagescms.org/docs/configuration/
# Content compiles at build time. CMS uploads feed optimized /assets/images output.

media:
  - name: images
    label: Images
    input: media/images
    output: /assets/images
    extensions: [png, jpg, jpeg, webp]
    rename: safe

content:
  - name: editorial
    label: Content
    type: group
    items:
      - name: posts
        label: Insights
        type: collection
        path: content/posts
        format: yaml-frontmatter
        filename: "{primary}.md"
        view:
          primary: title
          sort: date
          order: desc
        fields:
          - name: title
            type: string
            required: true
          - name: date
            type: date
            required: true
          - name: description
            type: text
          - name: image
            type: image
          - name: body
            type: rich-text
            required: true
      - name: pages
        label: Extra pages
        type: collection
        path: content/pages
        format: yaml-frontmatter
        filename: "{primary}.md"
        subfolders: false
        fields:
          - name: title
            type: string
            required: true
          - name: body
            type: rich-text
            required: true
  - name: site
    label: Site settings
    type: file
    path: src/site.json
    format: json
    operations:
      delete: false
    fields:
      - name: name
        type: string
        required: true
      - name: url
        type: string
        required: true
      - name: description
        type: text
        required: true
      - name: locale
        type: string
      - name: ogImage
        type: string
      - name: twitter
        type: string

settings:
  merge: false
`

const contentReadme = `# Content (PagesCMS)

Editors add files here via [Pages CMS](https://pagescms.org/). Paths match \`.pages.yml\`.

## Collections

| Folder | CMS label | Live URL |
| ------ | --------- | -------- |
| \`content/posts/\` | Insights | \`/insights/{slug}/\` |
| \`content/pages/\` | Extra pages | \`/{slug}/\` |

Markdown renders to static HTML at build time. Supported: headings with anchors, lists, tables, blockquotes, code fences, safe links/images, and PascalCase components. Unsafe HTML and unsafe URL protocols fail the build.

## Custom collections

Run \`bun run new collection projects --route work/{slug} --template project\` to add a custom markdown collection. The command updates \`content/collections.json\`, \`.pages.yml\`, \`content/{name}/\`, and \`src/templates/{template}.html\`.

## Site settings

\`src/site.json\` is editable in PagesCMS under **Site settings**. Rebuild after changes.
`

const postTemplate = `<head>
  <SEO title="{{title}}" description="{{description}}" path="/insights/{{basename}}/" />
  <meta name="snz:transition" content="fade">
</head>
<article class="post">
  <header>
    <h1>{{title}}</h1>
    <p class="meta">
      <time datetime="{{date}}">{{date}}</time>
    </p>
  </header>
  <div class="post-body">
    {{body}}
  </div>
  <footer>
    <Link href="/" label="← Home" />
  </footer>
</article>
`

const pageTemplate = `<head>
  <SEO title="{{title}}" description="{{description}}" path="/{{basename}}/" />
</head>
<article class="page">
  <h1>{{title}}</h1>
  <div class="page-body">
    {{body}}
  </div>
</article>
`

function collectionTemplate(collectionName: string, route: string) {
  const singular = singularize(collectionName)
  return `<head>
  <SEO title="{{title}}" description="{{description}}" path="/${route.replace('{slug}', '{{basename}}')}/" />
</head>
<article class="${singular}">
  <h1>{{title}}</h1>
  <div class="${singular}-body">
    {{body}}
  </div>
</article>
`
}

function collectionConfigEntry(collectionName: string, label: string, template: string, route: string) {
  return {
    name: collectionName,
    label,
    path: `content/${collectionName}`,
    template,
    route,
    required: ['title'],
    fields: [
      { name: 'title', type: 'string', required: true },
      { name: 'description', type: 'text' },
      { name: 'image', type: 'image' },
      { name: 'body', type: 'rich-text', required: true },
    ],
  }
}

async function readCollectionConfig(path: string) {
  let config: { collections: unknown[] } = { collections: [] }
  if (!(await exists(path))) return config

  try {
    const parsed = JSON.parse(await Bun.file(path).text())
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.collections)) throw new Error('expected { "collections": [] }')
    config = parsed
  } catch (err) {
    console.error(`invalid ${path}: ${err instanceof Error ? err.message : 'fix JSON syntax'}`)
    process.exit(1)
  }
  return config
}

async function writeCollectionConfig(collectionName: string, label: string, template: string, route: string) {
  const path = join(root, 'content', 'collections.json')
  const entry = collectionConfigEntry(collectionName, label, template, route)
  const config = await readCollectionConfig(path)

  const index = config.collections.findIndex((item) => item && typeof item === 'object' && (item as { name?: unknown }).name === collectionName)
  if (index !== -1 && !force) {
    console.error(`collection "${collectionName}" already exists in ${path} (pass --force to replace)`)
    process.exit(2)
  }
  if (index === -1) config.collections.push(entry)
  else config.collections[index] = entry

  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`)
  console.log(`${index === -1 ? 'wrote' : 'updated'} ${path}`)
}

function pagesCollectionBlock(collectionName: string, label: string) {
  return `      - name: ${collectionName}
        label: ${label}
        type: collection
        path: content/${collectionName}
        format: yaml-frontmatter
        filename: "{primary}.md"
        view:
          primary: title
        fields:
          - name: title
            type: string
            required: true
          - name: description
            type: text
          - name: image
            type: image
          - name: body
            type: rich-text
            required: true
`
}

function pagesCollectionPattern(collectionName: string) {
  return new RegExp(`\\n      - name: ${collectionName}\\n[\\s\\S]*?(?=\\n      - name: |\\n  - name: |\\nsettings:|$)`)
}

async function upsertPagesCollection(collectionName: string, label: string) {
  const path = join(root, '.pages.yml')
  if (!(await exists(path))) await writeIfMissing(path, pagesYml)

  const current = await Bun.file(path).text()
  const block = pagesCollectionBlock(collectionName, label)
  const itemPattern = pagesCollectionPattern(collectionName)
  if (itemPattern.test(current)) {
    if (!force) {
      console.error(`collection "${collectionName}" already exists in ${path} (pass --force to replace)`)
      process.exit(2)
    }
    await writeFile(path, current.replace(itemPattern, `\n${block.trimEnd()}`))
    console.log(`updated ${path}`)
    return
  }

  const marker = '\n  - name: site\n'
  if (!current.includes(marker)) {
    console.error(`could not find editorial group in ${path}`)
    process.exit(1)
  }
  await writeFile(path, current.replace(marker, `\n${block}${marker.slice(1)}`))
  console.log(`updated ${path}`)
}

if (kind === 'cms') {
  await writeIfMissing(join(root, '.pages.yml'), pagesYml)
  await writeIfMissing(join(root, 'content', 'README.md'), contentReadme)
  await writeIfMissing(join(root, 'content', 'posts', '.gitkeep'), '')
  await writeIfMissing(join(root, 'content', 'pages', '.gitkeep'), '')
  await writeIfMissing(join(root, 'media', 'images', '.gitkeep'), '')
  await writeIfMissing(join(root, 'src', 'templates', 'post.html'), postTemplate)
  await writeIfMissing(join(root, 'src', 'templates', 'page.html'), pageTemplate)
  console.log('\nCMS scaffold ready.')
  console.log('Next steps:')
  console.log('- bun run new post hello-world')
  console.log('- bun run new page about')
  console.log('- bun run check')
} else if (kind === 'component') {
  if (!/^[A-Z][A-Za-z0-9]*$/.test(requiredName)) {
    console.error(`component name must be PascalCase (got "${requiredName}")`)
    process.exit(1)
  }
  const html = `<!--
  @desc ${requiredName} — TODO describe what this component does.
  @attr title! Heading text.
-->
<article class="${requiredName.toLowerCase()}">
  <h2>{{title}}</h2>
  <div>{{slot}}</div>
</article>

<style>
  .${requiredName.toLowerCase()} {
    /* use tokens from src/styles.css; prefer elements/attrs before extra classes */
  }
</style>
`
  await writeIfMissing(join(root, 'src', 'components', `${requiredName}.html`), html)
  if (demo) {
    const stylesPath = (await exists(join(root, 'src', 'pages', 'styles.html')))
      ? join(root, 'src', 'pages', 'styles.html')
      : join(root, 'src', 'routes', 'styles.html')
    if (await exists(stylesPath)) {
      const append = `\n<section><div class="c"><${requiredName} title="${requiredName} demo">Demo content.</${requiredName}></div></section>\n`
      const cur = await Bun.file(stylesPath).text()
      await writeFile(stylesPath, cur + append)
      console.log(`appended demo to ${stylesPath}`)
    }
  }
} else if (kind === 'route') {
  if (!/^[a-z][a-z0-9-/]*$/.test(requiredName) || requiredName.includes('//') || requiredName.endsWith('/')) {
    console.error(`route slug must be kebab-case path (got "${requiredName}")`)
    process.exit(1)
  }
  const title = titleize(requiredName.split('/').at(-1) ?? requiredName)
  const html = `<head>
  <SEO title="${title}" description="..." />
</head>

<Section>
  <h1>${title}</h1>
  <p>Route body.</p>
</Section>
`
  await writeIfMissing(join(root, 'src', 'pages', `${requiredName}.html`), html)
} else if (kind === 'post' || kind === 'page') {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(requiredName)) {
    console.error(`${kind} slug must be kebab-case (got "${requiredName}")`)
    process.exit(1)
  }
  const dir = kind === 'post' ? 'posts' : 'pages'
  const md = `---
title: ${titleize(requiredName)}
date: ${today}
description: TODO
${kind === 'post' ? 'tags: []\n' : ''}---

Write here.
`
  await writeIfMissing(join(root, 'content', dir, `${requiredName}.md`), md)
} else if (kind === 'collection') {
  validateCollectionName(requiredName)
  const route = validateCollectionRoute(optionValue('--route') ?? `${requiredName}/{slug}`)
  const template = validateTemplateName(optionValue('--template') ?? singularize(requiredName))
  const label = optionValue('--label') ?? titleize(requiredName)
  const configPath = join(root, 'content', 'collections.json')
  const templatePath = join(root, 'src', 'templates', template)
  const pagesPath = join(root, '.pages.yml')

  const config = await readCollectionConfig(configPath)
  if (!force && config.collections.some((item) => item && typeof item === 'object' && (item as { name?: unknown }).name === requiredName)) {
    console.error(`collection "${requiredName}" already exists in ${configPath} (pass --force to replace)`)
    process.exit(2)
  }
  if (!force && await exists(templatePath)) {
    console.error(`refusing to overwrite ${templatePath} (pass --force to overwrite)`)
    process.exit(2)
  }
  if (!force && await exists(pagesPath) && pagesCollectionPattern(requiredName).test(await Bun.file(pagesPath).text())) {
    console.error(`collection "${requiredName}" already exists in ${pagesPath} (pass --force to replace)`)
    process.exit(2)
  }

  await writeCollectionConfig(requiredName, label, template, route)
  await mkdir(join(root, 'content', requiredName), { recursive: true })
  if (!(await exists(join(root, 'content', requiredName, '.gitkeep')))) await writeFile(join(root, 'content', requiredName, '.gitkeep'), '')
  await writeIfMissing(templatePath, collectionTemplate(requiredName, route))
  await upsertPagesCollection(requiredName, label)

  console.log('\nCollection scaffold ready.')
  console.log('Next steps:')
  console.log(`- add markdown files in content/${requiredName}/`)
  console.log('- bun run check')
}
