// CLI: bun run new <kind> <name> [--force] [--demo]
//      snz-bp add component <preset> [--force] [--demo]
// kind: component | route | post | page | cms
// route writes src/pages/*.html. page remains CMS content page. cms has no name.
//
// Writes the minimum viable shape for each. Refuses to overwrite without --force.

import { mkdir, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { root } from './paths'
import { addComponentPreset } from './component-presets'

type Kind = 'component' | 'route' | 'post' | 'page' | 'cms'
const rawArgs = process.argv.slice(2)
const isAdd = rawArgs[0] === 'add'
const args = isAdd ? rawArgs.slice(1) : rawArgs
const kind = args[0] as Kind | undefined
const name = args[1]
const force = args.includes('--force')
const demo = args.includes('--demo')

function usage(): never {
  console.error('Usage: bun run new <component|route|post|page> <name> [--force] [--demo]')
  console.error('       bun run new cms [--force]')
  console.error('       snz-bp add component <hero|logos|pricing|testimonial|faq> [--force] [--demo]')
  process.exit(1)
}

if (!kind) usage()
if (!['component', 'route', 'post', 'page', 'cms'].includes(kind)) usage()
if (kind !== 'cms' && !name) usage()
if (isAdd && kind !== 'component') usage()

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

if (isAdd) {
  await addComponentPreset(name!, { force, demo })
} else if (kind === 'cms') {
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
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name!)) {
    console.error(`component name must be PascalCase (got "${name}")`)
    process.exit(1)
  }
  const html = `<!--
  @desc ${name} — TODO describe what this component does.
  @attr title! Heading text.
-->
<article class="${name!.toLowerCase()}">
  <h2>{{title}}</h2>
  <div>{{slot}}</div>
</article>

<style>
  .${name!.toLowerCase()} {
    /* use tokens from src/styles.css; prefer elements/attrs before extra classes */
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
