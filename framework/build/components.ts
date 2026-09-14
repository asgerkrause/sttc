import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { BuildError } from './errors'
import type { ComponentSchema } from './compose'
import { parseInlineSchema } from './component-meta'
import { extractInlineScripts } from './extract-js'
import { stripStyleBlocks, type CssBlock } from './extract-css'
import { root } from './paths'
import { extractTemplateData } from './template-data'
import type { TemplateContext } from './template-directives'

function rendersImageBridge(html: string) {
  const renderable = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|textarea|title|template|noscript|iframe|noembed|xmp)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  const positions = [...renderable.matchAll(/\{\{imgMain\}\}/g)].map((match) => match.index)
  if (positions.length !== 1) return false
  const index = positions[0]!
  return renderable.lastIndexOf('<', index) < renderable.lastIndexOf('>', index)
}

/** Read components: strip inline <style> + <script>, build template + schema + script registries. */
export async function prepareComponents(componentsDir: string, projectRoot = root): Promise<{
  cssBlocks: CssBlock[]
  templates: Map<string, string>
  schemas: Map<string, ComponentSchema>
  scripts: Map<string, string[]>
  data: Map<string, TemplateContext>
}> {
  const cssBlocks: CssBlock[] = []
  const templates = new Map<string, string>()
  const schemas = new Map<string, ComponentSchema>()
  const scripts = new Map<string, string[]>()
  const data = new Map<string, TemplateContext>()
  let entries: string[]
  try {
    entries = await readdir(componentsDir)
  } catch {
    return { cssBlocks, templates, schemas, scripts, data }
  }

  const htmlFiles = entries.filter((file) => file.endsWith('.html')).sort()
  for (const file of htmlFiles) {
    const path = join(componentsDir, file)
    const raw = await readFile(path, 'utf8')
    const name = file.replace(/\.html$/i, '')
    if (name === 'SEO') {
      throw new BuildError('SEO is a renderer directive, not a component', {
        file: `src/components/${file}`,
        hint: 'Delete SEO.html and use one self-closing <SEO ... /> directive in each route <head>.',
      })
    }
    const { html: noData, data: componentData } = await extractTemplateData(raw, { file: `src/components/${file}`, projectRoot })
    if (Object.keys(componentData).length) data.set(name, componentData)
    const { html: noScript, scripts: blocks } = extractInlineScripts(noData)
    if (blocks.length) scripts.set(name, blocks)
    const { html: noComment, schema } = parseInlineSchema(noScript, `src/components/${file}`)
    if (schema.description || (schema.attrs && Object.keys(schema.attrs).length) || schema.schema) {
      schemas.set(name, schema)
    }
    const { html, css } = stripStyleBlocks(noComment)
    if (name === 'Image' && !rendersImageBridge(html)) {
      throw new BuildError('Image component must render the compiler image bridge exactly once as element content', {
        file: `src/components/${file}`,
        hint: 'Add one {{imgMain}} text placeholder to Image.html where the generated <img> must render. Do not put it in a comment or attribute.',
      })
    }
    templates.set(name, html)
    for (const chunk of css) cssBlocks.push({ source: file, css: chunk })
  }

  return { cssBlocks, templates, schemas, scripts, data }
}
