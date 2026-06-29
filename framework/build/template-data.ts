import { readFile } from 'fs/promises'
import { join, normalize, relative, resolve } from 'path'
import { buildErrorAt, BuildError } from './errors'
import type { TemplateContext, TemplateValue } from './template-directives'

const DATA_SCRIPT_RE = /<script\b(?=[^>]*\bdata-snz\b)(?=[^>]*\btype=["']application\/json["'])([^>]*)>([\s\S]*?)<\/script>/gi
const SRC_RE = /\bsrc=["']([^"']+)["']/i

export type TemplateDataResult = {
  html: string
  data: TemplateContext
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function toTemplateValue(value: unknown): TemplateValue {
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.map(toTemplateValue)
  if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toTemplateValue(item)])) as TemplateValue
  return String(value)
}

function parseJsonData(raw: string, file: string, source: string, offset: number): TemplateContext {
  const body = raw.trim()
  if (!body) return {}
  try {
    const parsed = JSON.parse(body)
    if (!isPlainObject(parsed)) {
      throw new BuildError('SNZ data JSON must be an object', {
        file,
        hint: 'Use { "items": [...] }, not an array or primitive at the top level.',
      })
    }
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, toTemplateValue(value)])) as TemplateContext
  } catch (err) {
    if (err instanceof BuildError) throw err
    throw buildErrorAt('Invalid SNZ data JSON', source, offset, {
      file,
      hint: err instanceof Error ? err.message : 'Fix JSON syntax.',
    })
  }
}

function safeDataPath(projectRoot: string, srcAttr: string) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(srcAttr) || srcAttr.startsWith('//')) {
    throw new BuildError('Remote SNZ data src is not allowed', {
      hint: 'Use a JSON file under src/data/ instead.',
    })
  }
  const normalized = srcAttr.replace(/\\/g, '/').replace(/^\/src\/data\//, '').replace(/^src\/data\//, '')
  if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..') || !normalized.endsWith('.json')) {
    throw new BuildError('SNZ data src must point to a JSON file under src/data/', {
      hint: 'Use src="services.json" or src="/src/data/services.json".',
    })
  }
  const dataRoot = resolve(projectRoot, 'src', 'data')
  const fullPath = resolve(dataRoot, normalize(normalized))
  const rel = relative(dataRoot, fullPath)
  if (rel.startsWith('..') || rel === '' || rel.startsWith('/')) {
    throw new BuildError('SNZ data src must stay inside src/data/', {
      hint: 'Path traversal is not allowed.',
    })
  }
  return fullPath
}

export async function extractTemplateData(html: string, options: {
  file: string
  projectRoot: string
}): Promise<TemplateDataResult> {
  const blocks: Array<{ full: string; attrs: string; body: string; index: number }> = []
  for (const match of html.matchAll(DATA_SCRIPT_RE)) {
    blocks.push({
      full: match[0],
      attrs: match[1] ?? '',
      body: match[2] ?? '',
      index: match.index ?? 0,
    })
  }
  if (!blocks.length) return { html, data: {} }

  const data: TemplateContext = {}
  for (const block of blocks) {
    const src = block.attrs.match(SRC_RE)?.[1]
    const raw = src
      ? await readFile(safeDataPath(options.projectRoot, src), 'utf8').catch((err) => {
          throw new BuildError(`Could not read SNZ data file "${src}"`, {
            file: options.file,
            hint: err instanceof Error ? err.message : 'Check the src/data path.',
          })
        })
      : block.body
    Object.assign(data, parseJsonData(raw, options.file, html, block.index))
  }

  return {
    html: html.replace(DATA_SCRIPT_RE, '').replace(/\n{3,}/g, '\n\n').trim(),
    data,
  }
}

export function hasTemplateData(data: TemplateContext) {
  return Object.keys(data).length > 0
}
