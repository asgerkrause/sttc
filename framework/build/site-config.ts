import { readFile } from 'fs/promises'
import { BuildError, lineOf } from './errors'
import { resolve } from 'path'
import type { SiteConfig } from './seo'

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function displayFile(file: string) {
  const rel = file.startsWith('/') ? file.replace(`${process.cwd()}/`, '') : file
  return rel === file && file.startsWith('/') ? file : rel
}

function keyLine(raw: string, key: string) {
  const match = new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:`).exec(raw)
  return match?.index === undefined ? 1 : lineOf(raw, match.index)
}

function fail(raw: string, key: string, message: string, hint: string): never {
  throw new BuildError(message, { file: 'src/site.json', line: keyLine(raw, key), hint })
}

function optionalString(raw: string, owner: Record<string, unknown>, key: string) {
  const value = owner[key]
  if (value === undefined) return
  if (typeof value !== 'string') fail(raw, key, `site.json "${key}" must be a string`, `Set "${key}" to a string or remove it.`)
}

function cleanToken(value: string) {
  return value.trim().length > 0 && !/[\r\n]/.test(value)
}

function validateRobots(raw: string, value: unknown) {
  if (value === undefined) return
  if (!isObject(value) || (value.groups !== undefined && !Array.isArray(value.groups))) {
    fail(raw, 'robots', 'site.json robots must contain a groups array', 'Use { "robots": { "groups": [...] } }.')
  }
  for (const group of (value.groups ?? []) as unknown[]) {
    if (!isObject(group) || !Array.isArray(group.userAgents) || !group.userAgents.length || group.userAgents.some((item) => typeof item !== 'string' || !cleanToken(item))) {
      fail(raw, 'robots', 'Each robots group needs at least one user agent', 'Use { "userAgents": ["*"], "allow": ["/"] }.')
    }
    for (const key of ['allow', 'disallow'] as const) {
      if (group[key] !== undefined && (!Array.isArray(group[key]) || group[key].some((item) => typeof item !== 'string' || !cleanToken(item) || !item.startsWith('/')))) {
        fail(raw, 'robots', `robots ${key} must contain root-relative paths`, `Use paths such as "/" or "/private/".`)
      }
    }
  }
}

function validateProduct(raw: string, value: unknown) {
  if (value === undefined) return
  if (!isObject(value)) fail(raw, 'product', 'site.json product must be an object', 'Declare name, description, and canonical path.')
  for (const key of ['name', 'description', 'path']) {
    if (typeof value[key] !== 'string' || !value[key].trim()) fail(raw, key, `site.json product.${key} is required`, `Set product.${key} to a non-empty string.`)
  }
  if (!(value.path as string).startsWith('/') || !(value.path as string).endsWith('/')) {
    fail(raw, 'path', 'site.json product.path must be a canonical route path', 'Use a path such as "/platform/".')
  }
  if (value.offers !== undefined) {
    if (!isObject(value.offers)) fail(raw, 'offers', 'site.json product.offers must be an object', 'Declare only truthful visible offer facts.')
    const offer = value.offers
    for (const key of ['price', 'priceCurrency']) optionalString(raw, offer, key)
    if ((offer.price === undefined) !== (offer.priceCurrency === undefined)) {
      fail(raw, 'offers', 'Product offer price and currency must be declared together', 'Set both price and priceCurrency, or omit both.')
    }
  }
}

export function parseSiteConfig(raw: string, file = 'src/site.json'): SiteConfig {
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch (error) {
    throw new BuildError('src/site.json is not valid JSON', {
      file,
      line: 1,
      hint: error instanceof Error ? error.message : 'Fix JSON syntax.',
    })
  }
  if (!isObject(parsed)) fail(raw, 'name', 'src/site.json must contain an object', 'Start with name, url, and description.')
  for (const key of ['name', 'url', 'description']) {
    if (typeof parsed[key] !== 'string' || !parsed[key].trim()) fail(raw, key, `site.json "${key}" is required`, `Set "${key}" to a non-empty string.`)
  }
  for (const key of ['locale', 'twitter', 'image', 'ogImage']) optionalString(raw, parsed, key)
  if (parsed.scroll !== undefined && parsed.scroll !== 'lenis' && parsed.scroll !== 'native') {
    fail(raw, 'scroll', 'site.json "scroll" must be "lenis" or "native"', 'Use "lenis" for smooth scrolling or "native" to exclude Lenis from the build.')
  }
  try {
    const url = new URL(parsed.url as string)
    if (!/^https?:$/.test(url.protocol) || url.pathname !== '/' || url.search || url.hash) throw new Error()
    parsed.url = url.origin
  } catch {
    fail(raw, 'url', 'site.json "url" must be an HTTP(S) origin', 'Use an origin such as https://example.com with no path, query, or hash.')
  }
  validateProduct(raw, parsed.product)
  validateRobots(raw, parsed.robots)
  return parsed as SiteConfig
}

export async function loadSiteConfig(file: string) {
  const fullPath = resolve(file)
  const shown = displayFile(fullPath)
  const raw = await readFile(fullPath, 'utf8').catch((error) => {
    throw new BuildError('Could not read src/site.json', {
      file: shown,
      hint: error instanceof Error ? error.message : 'Create src/site.json.',
    })
  })
  return parseSiteConfig(raw, shown)
}


