import { BuildError } from './errors'
import { escapeHtml } from './html'

export type SafeHtml = { kind: 'html'; value: string }
export type TemplateValue = string | number | boolean | null | undefined | SafeHtml | TemplateValue[] | { [key: string]: TemplateValue }
export type TemplateContext = Record<string, TemplateValue>

type SortDirection = 'asc' | 'desc'
type SortKey = { path: string; direction: SortDirection }

type DirectiveToken =
  | { kind: 'ifOpen'; expr: string; index: number; end: number }
  | { kind: 'eachOpen'; source: string; alias: string; indexAlias?: string; sort?: SortKey[]; index: number; end: number }
  | { kind: 'else'; index: number; end: number }
  | { kind: 'elseIf'; expr: string; index: number; end: number }
  | { kind: 'close'; name: 'if' | 'each'; index: number; end: number }

type RenderOptions = {
  placeholders?: boolean
  preserveUnknownPlaceholders?: boolean
  allowEach?: boolean
  file?: string
}

const TOKEN_RE = /\{#if\s+([^}]+)\}|\{#each\s+([^}]+)\}|\{:else\s+if\s+([^}]+)\}|\{:else\}|\{\/(if|each)\}/g
const PLACEHOLDER_RE = /\{\{\s*([^}]+?)\s*\}\}/g
const PATH_RE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$|^slot:[\w-]+$/
const EACH_EXPR_RE = /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)(?:\s+sort\s+(.+?))?\s+as\s+([A-Za-z_$][\w$]*)(?:\s*,\s*([A-Za-z_$][\w$]*))?$/
const SORT_ITEM_RE = /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s+(asc|desc)$/
const FILTER_RE = /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\|\s*([A-Za-z_$][\w$]*)$/

function assertNever(value: never): never {
  throw new Error(`Unhandled template directive token ${(value as { kind?: string }).kind}`)
}

export function html(value: string): SafeHtml {
  return { kind: 'html', value }
}

function isSafeHtml(value: TemplateValue): value is SafeHtml {
  return !!value && typeof value === 'object' && !Array.isArray(value) && (value as { kind?: unknown }).kind === 'html' && typeof (value as { value?: unknown }).value === 'string'
}

function valueToString(value: TemplateValue, rawHtml: boolean) {
  if (value == null) return ''
  if (isSafeHtml(value)) return rawHtml ? value.value : escapeHtml(value.value)
  if (Array.isArray(value) || typeof value === 'object') return escapeHtml(JSON.stringify(value))
  return escapeHtml(String(value))
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Filters run on plain text; the interpolation escapes the result once. */
function applyFilter(value: TemplateValue, filter: string): TemplateValue {
  const text = value == null ? '' : isSafeHtml(value) ? value.value : typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (filter === 'lower') return text.toLowerCase()
  if (filter === 'slug') return slugify(text)
  throw new BuildError(`Unknown component placeholder filter "${filter}"`, {
    hint: 'Supported filters: lower, slug.',
  })
}

function getPath(context: TemplateContext, path: string): TemplateValue {
  if (Object.prototype.hasOwnProperty.call(context, path)) return context[path]
  const parts = path.split('.')
  let value: TemplateValue = context[parts[0]!]
  for (const part of parts.slice(1)) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || isSafeHtml(value)) return undefined
    value = value[part]
  }
  return value
}

function isTruthy(value: TemplateValue) {
  if (value == null || value === false) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (isSafeHtml(value)) return value.value.trim().length > 0
  return true
}

function parseSort(sort: string): SortKey[] {
  return sort.split(',').map((raw) => {
    const item = raw.trim()
    const match = item.match(SORT_ITEM_RE)
    if (!match) {
      throw new BuildError(`Invalid component each sort "${item}"`, {
        hint: 'Use sort name asc or sort name desc. Multiple keys: sort featured desc, date desc.',
      })
    }
    return { path: match[1]!, direction: match[2]! as SortDirection }
  })
}

function parseEachExpr(expr: string, index: number, end: number): DirectiveToken {
  const match = expr.trim().match(EACH_EXPR_RE)
  if (!match) {
    throw new BuildError(`Invalid component each "${expr.trim()}"`, {
      hint: 'Use {#each items as item}, {#each items as item, i}, or {#each items sort name asc as item}. No expressions yet.',
    })
  }
  const source = match[1]!
  const sort = match[2] ? parseSort(match[2]) : undefined
  const alias = match[3]!
  const indexAlias = match[4]
  return indexAlias
    ? { kind: 'eachOpen', source, alias, indexAlias, sort, index, end }
    : { kind: 'eachOpen', source, alias, sort, index, end }
}

function tokenize(template: string): DirectiveToken[] {
  TOKEN_RE.lastIndex = 0
  const tokens: DirectiveToken[] = []
  for (const match of template.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0
    const raw = match[0]
    if (match[1] !== undefined) tokens.push({ kind: 'ifOpen', expr: match[1], index, end: index + raw.length })
    else if (match[2] !== undefined) tokens.push(parseEachExpr(match[2], index, index + raw.length))
    else if (match[3] !== undefined) tokens.push({ kind: 'elseIf', expr: match[3], index, end: index + raw.length })
    else if (raw === '{:else}') tokens.push({ kind: 'else', index, end: index + raw.length })
    else if (match[4] === 'if' || match[4] === 'each') tokens.push({ kind: 'close', name: match[4], index, end: index + raw.length })
  }
  return tokens
}

function validatePath(expr: string) {
  const key = expr.trim()
  if (!key) throw new BuildError('Empty component conditional', { hint: 'Use {#if attr}, {#if slot}, or {#if slot:name}.' })
  if (!PATH_RE.test(key) && !/^[\w-]+$/.test(key) && !/^slot(?::[\w-]+)?$/.test(key)) {
    throw new BuildError(`Invalid component conditional "${key}"`, {
      hint: 'Supported conditions: attr, slot, slot:name, or dotted content paths. No expressions yet.',
    })
  }
  return key
}

type BranchToken = Extract<DirectiveToken, { kind: 'else' | 'elseIf' }>

function blockName(token: DirectiveToken) {
  return token.kind === 'eachOpen' || (token.kind === 'close' && token.name === 'each') ? 'each' : 'if'
}

/** Finds the close of `open`, skipping nested blocks; returns the depth-0 branch tokens in order. */
function findClose(tokens: DirectiveToken[], open: DirectiveToken, start: number, file?: string) {
  const stack: DirectiveToken[] = [open]
  const branches: BranchToken[] = []
  for (let i = start; i < tokens.length; i++) {
    const token = tokens[i]!
    switch (token.kind) {
      case 'ifOpen':
      case 'eachOpen':
        stack.push(token)
        break
      case 'close': {
        const current = stack.pop()!
        if (token.name !== blockName(current)) {
          throw new BuildError(`Unexpected component ${token.name} close`, { hint: `Close the current {#${blockName(current)} ...} block first.` })
        }
        if (!stack.length) return { token, tokenIndex: i, branches }
        break
      }
      case 'else':
      case 'elseIf':
        if (stack.length === 1) branches.push(token)
        break
      default:
        assertNever(token)
    }
  }
  const name = blockName(open)
  throw new BuildError(`Unclosed component ${name === 'if' ? 'conditional' : 'each'} block`, {
    file,
    hint: `Every {#${name} ...} needs a matching {/${name}}.`,
  })
}

export function renderPlaceholders(segment: string, context: TemplateContext, options: RenderOptions) {
  if (!options.placeholders) return segment
  return segment.replace(PLACEHOLDER_RE, (full, expr) => {
    const raw = String(expr).trim()
    const filterMatch = raw.match(FILTER_RE)
    const path = filterMatch ? filterMatch[1]! : raw
    if (!PATH_RE.test(path)) {
      throw new BuildError(`Invalid component placeholder "${raw}"`, {
        hint: 'Use {{name}}, {{item.name}}, {{name | lower}}, or {{name | slug}}. No expressions yet.',
      })
    }
    const value = getPath(context, path)
    if (value === undefined && options.preserveUnknownPlaceholders) return full
    const rendered = filterMatch ? applyFilter(value, filterMatch[2]!) : value
    return valueToString(rendered, true)
  })
}

function sortableValue(value: TemplateValue): string | number | undefined {
  if (value == null || isSafeHtml(value) || Array.isArray(value) || typeof value === 'object') return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'boolean') return value ? 1 : 0
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const numeric = Number(trimmed)
  if (trimmed !== '' && Number.isFinite(numeric)) return numeric
  const timestamp = Date.parse(trimmed)
  if (Number.isFinite(timestamp) && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) return timestamp
  return trimmed
}

function compareValues(a: TemplateValue, b: TemplateValue, direction: SortDirection) {
  const av = sortableValue(a)
  const bv = sortableValue(b)
  const dir = direction === 'asc' ? 1 : -1
  if (av === undefined && bv === undefined) return 0
  if (av === undefined) return 1
  if (bv === undefined) return -1
  if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
  return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir
}

function sortedEachSource(source: TemplateValue[], sort: SortKey[] | undefined) {
  if (!sort?.length) return source
  return source.map((item, index) => ({ item, index })).sort((a, b) => {
    const context = { item: a.item, other: b.item }
    for (const key of sort) {
      const result = compareValues(getPath(context, `item.${key.path}`), getPath(context, `other.${key.path}`), key.direction)
      if (result !== 0) return result
    }
    return a.index - b.index
  }).map(({ item }) => item)
}

export function renderTemplate(template: string, context: TemplateContext, options: RenderOptions = {}): string {
  const tokens = tokenize(template)
  if (!tokens.length) return renderPlaceholders(template, context, options)

  let out = ''
  let cursor = 0
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!
    switch (token.kind) {
      case 'ifOpen': {
        out += renderPlaceholders(template.slice(cursor, token.index), context, options)
        const close = findClose(tokens, token, i + 1, options.file)
        const elseAt = close.branches.findIndex((item) => item.kind === 'else')
        if (elseAt !== -1 && elseAt !== close.branches.length - 1) {
          throw new BuildError('Duplicate component conditional else', { hint: 'Use at most one {:else} per {#if ...} block, after any {:else if ...}.' })
        }
        // Each branch owns the body up to the next branch token; every condition is validated, the first truthy one renders.
        const heads = [token, ...close.branches]
        const ends = [...close.branches, close.token]
        let pickedAt = -1
        heads.forEach((head, b) => {
          const taken = head.kind === 'else' || isTruthy(getPath(context, validatePath(head.expr)))
          if (taken && pickedAt === -1) pickedAt = b
        })
        const picked = pickedAt === -1 ? '' : template.slice(heads[pickedAt]!.end, ends[pickedAt]!.index)
        out += renderTemplate(picked, context, options)
        cursor = close.token.end
        i = close.tokenIndex
        break
      }
      case 'eachOpen': {
        if (!options.allowEach) throw new BuildError('Unsupported component each block', { file: options.file, hint: '{#each ...} needs build-time JSON data. Declare <script type="application/json" data-snz> or load src/data/*.json in the component.' })
        out += renderPlaceholders(template.slice(cursor, token.index), context, options)
        const close = findClose(tokens, token, i + 1, options.file)
        if (close.branches.length) throw new BuildError('Unsupported component each branch', { hint: '{#each ...} does not support {:else} yet.' })
        const source = getPath(context, token.source)
        if (!Array.isArray(source)) {
          throw new BuildError(`Component each source "${token.source}" is not an array`, {
            file: options.file,
            hint: 'Use a YAML array in front matter, then {#each items as item}.',
          })
        }
        const body = template.slice(token.end, close.token.index)
        out += sortedEachSource(source, token.sort).map((item, index) => renderTemplate(body, {
          ...context,
          [token.alias]: item,
          ...(token.indexAlias ? { [token.indexAlias]: index } : {}),
        }, options)).join('')
        cursor = close.token.end
        i = close.tokenIndex
        break
      }
      case 'else':
      case 'elseIf':
        throw new BuildError('Unsupported component conditional branch', { hint: '{:else} must be inside a {#if ...} block.' })
      case 'close':
        throw new BuildError(`Unexpected component ${token.name} close`, { hint: `Remove unmatched {/${token.name}}.` })
      default:
        assertNever(token)
    }
  }
  out += renderPlaceholders(template.slice(cursor), context, options)
  return out
}
