import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { BuildError, lineOf } from './errors'
import { isJsonObject, isText, type Json, type JsonObject } from './json'
import type {
  RobotsGroup,
  SiteAddress,
  SiteBrand,
  SiteConfig,
  SiteContact,
  SiteOffer,
  SiteOrganization,
  SitePerson,
  SiteProduct,
} from './seo'

const SITE_KEYS = [
  'name',
  'url',
  'description',
  'locale',
  'twitter',
  'image',
  'ogImage',
  'scroll',
  'organization',
  'brand',
  'product',
  'author',
  'authors',
  'sameAs',
  'contact',
  'address',
  'topics',
  'discovery',
  'robots',
] as const
const CONTACT_KEYS = ['email', 'telephone', 'url'] as const
const ADDRESS_KEYS = ['streetAddress', 'addressLocality', 'addressRegion', 'postalCode', 'addressCountry'] as const
const BRAND_KEYS = ['name', 'slogan', 'logo'] as const
const OFFER_KEYS = ['price', 'priceCurrency', 'availability', 'url'] as const
const PRODUCT_TEXT_KEYS = ['type', 'category', 'image', 'sku', 'audience'] as const
const PRODUCT_KEYS = ['name', 'description', 'path', ...PRODUCT_TEXT_KEYS, 'offers'] as const
const ORGANIZATION_KEYS = ['name', 'legalName', 'logo', 'sameAs', 'contact', 'address'] as const
const PERSON_KEYS = ['name', 'url', 'sameAs', 'jobTitle', 'image'] as const
const DISCOVERY_KEYS = ['featured', 'notes'] as const
const ROBOTS_KEYS = ['groups'] as const
const ROBOTS_GROUP_KEYS = ['userAgents', 'allow', 'disallow'] as const

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

function setDefined<T, K extends keyof T>(target: T, key: K, value: T[K] | undefined) {
  if (value !== undefined) target[key] = value
}

/** Every value is a string, or undefined when one is not. */
function texts(values: Json[]): string[] | undefined {
  const out: string[] = []
  for (const value of values) {
    if (!isText(value)) return undefined
    out.push(value)
  }
  return out
}

function rejectUnknownKeys(raw: string, owner: JsonObject, known: readonly string[], prefix: string) {
  for (const key of Object.keys(owner)) {
    if (!known.includes(key)) {
      fail(
        raw,
        key,
        `site.json "${prefix}${key}" is not a known setting`,
        `Remove it or fix the spelling. Known keys: ${known.join(', ')}.`,
      )
    }
  }
}

function optionalString(raw: string, owner: JsonObject, key: string, label = key) {
  const value = owner[key]
  if (value === undefined) return undefined
  if (!isText(value))
    fail(raw, key, `site.json "${label}" must be a string`, `Set "${label}" to a string or remove it.`)
  return value
}

function requiredString(raw: string, owner: JsonObject, key: string) {
  const value = owner[key]
  if (!isText(value) || !value.trim())
    fail(raw, key, `site.json "${key}" is required`, `Set "${key}" to a non-empty string.`)
  return value
}

function optionalObject(raw: string, owner: JsonObject, key: string, label: string) {
  const value = owner[key]
  if (value === undefined) return undefined
  if (!isJsonObject(value))
    fail(raw, key, `site.json "${label}" must be an object`, `Set "${label}" to an object or remove it.`)
  return value
}

function cleanToken(value: string) {
  return value.trim().length > 0 && !/[\r\n]/.test(value)
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** HTTP(S) URLs; empty entries are allowed and kept. */
function decodeSameAs(raw: string, value: Json | undefined, label: string) {
  if (value === undefined) return undefined
  const items = Array.isArray(value) ? texts(value) : undefined
  if (!items || items.some((item) => item.trim() !== '' && !isHttpUrl(item))) {
    fail(
      raw,
      'sameAs',
      `site.json "${label}.sameAs" must be HTTP(S) URLs`,
      `Use an array of http(s) URLs, or omit sameAs.`,
    )
  }
  return items
}

function decodeContact(raw: string, owner: JsonObject, label: string) {
  const value = optionalObject(raw, owner, 'contact', label)
  if (!value) return undefined
  const contact: SiteContact = {}
  for (const key of CONTACT_KEYS) setDefined(contact, key, optionalString(raw, value, key, `${label}.${key}`))
  rejectUnknownKeys(raw, value, CONTACT_KEYS, `${label}.`)
  return contact
}

function decodeAddress(raw: string, owner: JsonObject, label: string) {
  const value = optionalObject(raw, owner, 'address', label)
  if (!value) return undefined
  const address: SiteAddress = {}
  for (const key of ADDRESS_KEYS) setDefined(address, key, optionalString(raw, value, key, `${label}.${key}`))
  rejectUnknownKeys(raw, value, ADDRESS_KEYS, `${label}.`)
  return address
}

function decodeRobots(raw: string, value: Json | undefined) {
  if (value === undefined) return undefined
  if (!isJsonObject(value) || (value.groups !== undefined && !Array.isArray(value.groups))) {
    fail(raw, 'robots', 'site.json robots must contain a groups array', 'Use { "robots": { "groups": [...] } }.')
  }
  const groups: RobotsGroup[] = []
  for (const group of Array.isArray(value.groups) ? value.groups : []) {
    const userAgents = isJsonObject(group) && Array.isArray(group.userAgents) ? texts(group.userAgents) : undefined
    if (!isJsonObject(group) || !userAgents || !userAgents.length || userAgents.some((item) => !cleanToken(item))) {
      fail(
        raw,
        'robots',
        'Each robots group needs at least one user agent',
        'Use { "userAgents": ["*"], "allow": ["/"] }.',
      )
    }
    const decoded: RobotsGroup = { userAgents }
    for (const key of ['allow', 'disallow'] as const) {
      const entry = group[key]
      if (entry === undefined) continue
      const paths = Array.isArray(entry) ? texts(entry) : undefined
      if (!paths || paths.some((item) => !cleanToken(item) || !item.startsWith('/'))) {
        fail(raw, 'robots', `robots ${key} must contain root-relative paths`, `Use paths such as "/" or "/private/".`)
      }
      decoded[key] = paths
    }
    rejectUnknownKeys(raw, group, ROBOTS_GROUP_KEYS, 'robots.groups.')
    groups.push(decoded)
  }
  rejectUnknownKeys(raw, value, ROBOTS_KEYS, 'robots.')
  return value.groups === undefined ? {} : { groups }
}

function decodePerson(raw: string, value: Json, key: string) {
  if (!isJsonObject(value))
    fail(raw, key, `site.json "${key}" must be an object`, `Set "${key}" to an object with a non-empty name.`)
  const name = value.name
  if (!isText(name) || !name.trim()) {
    fail(raw, key, `site.json "${key}.name" is required`, `Set "${key}.name" to a non-empty string.`)
  }
  const person: SitePerson = { name }
  for (const field of ['url', 'jobTitle', 'image'] as const)
    setDefined(person, field, optionalString(raw, value, field))
  setDefined(person, 'sameAs', decodeSameAs(raw, value.sameAs, key))
  rejectUnknownKeys(raw, value, PERSON_KEYS, `${key}.`)
  return person
}

function decodeAuthors(raw: string, value: Json | undefined) {
  if (value === undefined) return undefined
  if (!Array.isArray(value))
    fail(raw, 'authors', 'site.json "authors" must be an array', 'Use an array of people, each with a name.')
  return value.map((person) => decodePerson(raw, person, 'authors'))
}

function decodeDiscovery(raw: string, value: Json | undefined) {
  if (value === undefined) return undefined
  if (!isJsonObject(value))
    fail(raw, 'discovery', 'site.json discovery must be an object', 'Use { "featured": ["about"], "notes": "..." }.')
  const discovery: NonNullable<SiteConfig['discovery']> = {}
  if (value.featured !== undefined) {
    const featured = Array.isArray(value.featured) ? texts(value.featured) : undefined
    if (!featured || featured.some((item) => !item.trim() || item.startsWith('/') || item.includes('.html'))) {
      fail(
        raw,
        'featured',
        'site.json discovery.featured must be slug strings',
        'Use slugs such as "index" or "insights/hello" with no leading slash or .html.',
      )
    }
    discovery.featured = featured
  }
  const notes = value.notes
  if (notes !== undefined) {
    if (!isText(notes))
      fail(raw, 'notes', 'site.json discovery.notes must be a string', 'Set discovery.notes to a string or remove it.')
    if (notes.includes('##')) {
      fail(
        raw,
        'notes',
        'site.json discovery.notes cannot contain markdown headings',
        'llms.txt v2 forbids headings in the notes block. Remove ## from discovery.notes.',
      )
    }
    discovery.notes = notes
  }
  rejectUnknownKeys(raw, value, DISCOVERY_KEYS, 'discovery.')
  return discovery
}

function requiredProductString(raw: string, owner: JsonObject, key: string) {
  const value = owner[key]
  if (!isText(value) || !value.trim())
    fail(raw, key, `site.json product.${key} is required`, `Set product.${key} to a non-empty string.`)
  return value
}

function decodeOffer(raw: string, value: Json | undefined) {
  if (value === undefined) return undefined
  if (!isJsonObject(value))
    fail(raw, 'offers', 'site.json product.offers must be an object', 'Declare only truthful visible offer facts.')
  const offer: SiteOffer = {}
  for (const key of ['price', 'priceCurrency'] as const) setDefined(offer, key, optionalString(raw, value, key))
  if ((offer.price === undefined) !== (offer.priceCurrency === undefined)) {
    fail(
      raw,
      'offers',
      'Product offer price and currency must be declared together',
      'Set both price and priceCurrency, or omit both.',
    )
  }
  for (const key of ['availability', 'url'] as const)
    setDefined(offer, key, optionalString(raw, value, key, `product.offers.${key}`))
  rejectUnknownKeys(raw, value, OFFER_KEYS, 'product.offers.')
  return offer
}

function decodeProduct(raw: string, value: Json | undefined) {
  if (value === undefined) return undefined
  if (!isJsonObject(value))
    fail(raw, 'product', 'site.json product must be an object', 'Declare name, description, and canonical path.')
  const name = requiredProductString(raw, value, 'name')
  const description = requiredProductString(raw, value, 'description')
  const path = requiredProductString(raw, value, 'path')
  if (!path.startsWith('/') || !path.endsWith('/')) {
    fail(raw, 'path', 'site.json product.path must be a canonical route path', 'Use a path such as "/platform/".')
  }
  const product: SiteProduct = { name, description, path }
  setDefined(product, 'offers', decodeOffer(raw, value.offers))
  for (const key of PRODUCT_TEXT_KEYS) setDefined(product, key, optionalString(raw, value, key, `product.${key}`))
  rejectUnknownKeys(raw, value, PRODUCT_KEYS, 'product.')
  return product
}

function decodeBrand(raw: string, owner: JsonObject) {
  const value = optionalObject(raw, owner, 'brand', 'brand')
  if (!value) return undefined
  const brand: SiteBrand = {}
  for (const key of BRAND_KEYS) setDefined(brand, key, optionalString(raw, value, key, `brand.${key}`))
  rejectUnknownKeys(raw, value, BRAND_KEYS, 'brand.')
  return brand
}

function decodeOrganization(raw: string, owner: JsonObject) {
  const value = optionalObject(raw, owner, 'organization', 'organization')
  if (!value) return undefined
  const organization: SiteOrganization = {}
  for (const key of ['name', 'legalName', 'logo'] as const)
    setDefined(organization, key, optionalString(raw, value, key, `organization.${key}`))
  setDefined(organization, 'sameAs', decodeSameAs(raw, value.sameAs, 'organization'))
  setDefined(organization, 'contact', decodeContact(raw, value, 'organization.contact'))
  setDefined(organization, 'address', decodeAddress(raw, value, 'organization.address'))
  rejectUnknownKeys(raw, value, ORGANIZATION_KEYS, 'organization.')
  return organization
}

function decodeTopics(raw: string, value: Json | undefined) {
  if (value === undefined) return undefined
  const topics = Array.isArray(value) ? texts(value) : undefined
  if (!topics)
    fail(
      raw,
      'topics',
      'site.json "topics" must be an array of strings',
      'Use an array such as ["design", "branding"].',
    )
  return topics
}

function decodeUrl(raw: string, value: string) {
  try {
    const url = new URL(value)
    if (/^https?:$/.test(url.protocol) && url.pathname === '/' && !url.search && !url.hash) return url.origin
  } catch {
    // Reported below with the same message as a non-origin URL.
  }
  return fail(
    raw,
    'url',
    'site.json "url" must be an HTTP(S) origin',
    'Use an origin such as https://example.com with no path, query, or hash.',
  )
}

export function parseSiteConfig(raw: string, file = 'src/site.json'): SiteConfig {
  let parsed: Json
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new BuildError('src/site.json is not valid JSON', {
      file,
      line: 1,
      hint: error instanceof Error ? error.message : 'Fix JSON syntax.',
    })
  }
  if (!isJsonObject(parsed))
    fail(raw, 'name', 'src/site.json must contain an object', 'Start with name, url, and description.')

  const name = requiredString(raw, parsed, 'name')
  const url = requiredString(raw, parsed, 'url')
  const description = requiredString(raw, parsed, 'description')
  const site: SiteConfig = { name, url, description }
  for (const key of ['locale', 'twitter', 'image', 'ogImage'] as const)
    setDefined(site, key, optionalString(raw, parsed, key))
  const scroll = parsed.scroll
  if (scroll === 'lenis' || scroll === 'native') site.scroll = scroll
  else if (scroll !== undefined) {
    fail(
      raw,
      'scroll',
      'site.json "scroll" must be "lenis" or "native"',
      'Use "lenis" for smooth scrolling or "native" to exclude Lenis from the build.',
    )
  }
  site.url = decodeUrl(raw, url)

  // Checks that existed before the decoder keep their order, so existing errors win.
  setDefined(site, 'product', decodeProduct(raw, parsed.product))
  setDefined(site, 'robots', decodeRobots(raw, parsed.robots))
  if (parsed.author !== undefined) site.author = decodePerson(raw, parsed.author, 'author')
  setDefined(site, 'authors', decodeAuthors(raw, parsed.authors))
  setDefined(site, 'discovery', decodeDiscovery(raw, parsed.discovery))

  setDefined(site, 'organization', decodeOrganization(raw, parsed))
  setDefined(site, 'brand', decodeBrand(raw, parsed))
  setDefined(site, 'sameAs', decodeSameAs(raw, parsed.sameAs, 'site'))
  setDefined(site, 'contact', decodeContact(raw, parsed, 'contact'))
  setDefined(site, 'address', decodeAddress(raw, parsed, 'address'))
  setDefined(site, 'topics', decodeTopics(raw, parsed.topics))
  rejectUnknownKeys(raw, parsed, SITE_KEYS, '')
  return site
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
