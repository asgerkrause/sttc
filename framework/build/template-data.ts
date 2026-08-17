import { readFile, realpath } from 'fs/promises'
import { normalize, relative, resolve } from 'path'
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

function jsonErrorPosition(error: unknown) {
  if (!(error instanceof Error)) return undefined
  const position = error.message.match(/position\s+(\d+)/i)
  return position ? Number(position[1]) : undefined
}

function approximateJsonErrorLine(source: string, error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const token = message.match(/Unexpected token ['"]?([^'"]+)['"]?/i)?.[1]
  if (token && token.length === 1) {
    const index = source.lastIndexOf(token)
    if (index >= 0) return lineAt(source, index)
  }
  return Math.max(1, source.trimEnd().split('\n').length)
}

function lineAt(source: string, index: number) {
  let line = 1
  for (let i = 0; i < index && i < source.length; i++) if (source[i] === '\n') line++
  return line
}

function parseJsonData(raw: string, file: string, source: string, offset: number, jsonFile = file): TemplateContext {
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
    const message = err instanceof Error ? err.message : 'Fix JSON syntax.'
    const position = jsonErrorPosition(err)
    if (jsonFile !== file) {
      throw new BuildError('Invalid SNZ data JSON', {
        file: jsonFile,
        line: position === undefined ? approximateJsonErrorLine(raw, err) : lineAt(raw, position),
        hint: message,
      })
    }
    throw buildErrorAt('Invalid SNZ data JSON', source, offset + (position ?? 0), {
      file,
      hint: message,
    })
  }
}

async function safeDataPath(projectRoot: string, srcAttr: string) {
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
  const [realRoot, realFile] = await Promise.all([
    realpath(dataRoot).catch(() => dataRoot),
    realpath(fullPath).catch(() => fullPath),
  ])
  const realRel = relative(realRoot, realFile)
  if (realRel.startsWith('..') || realRel.startsWith('/') || realRel === '') {
    throw new BuildError('SNZ data src must stay inside src/data/', {
      hint: 'Symlinked files outside src/data are not allowed.',
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
    const dataPath = src ? await safeDataPath(options.projectRoot, src) : undefined
    const raw = dataPath
      ? await readFile(dataPath, 'utf8').catch((err) => {
          throw new BuildError(`Could not read SNZ data file "${src}"`, {
            file: options.file,
            hint: err instanceof Error ? err.message : 'Check the src/data path.',
          })
        })
      : block.body
    const dataFile = src ? `src/data/${src.replace(/\\/g, '/').replace(/^\/src\/data\//, '').replace(/^src\/data\//, '')}` : options.file
    Object.assign(data, parseJsonData(raw, options.file, html, block.index, dataFile))
  }

  return {
    html: html.replace(DATA_SCRIPT_RE, '').replace(/\n{3,}/g, '\n\n').trim(),
    data,
  }
}


