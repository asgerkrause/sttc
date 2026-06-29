import { BuildError } from './errors'
import type { TemplateContext, TemplateValue } from './template-directives'

type Fetcher = typeof fetch

type PolarOptions = {
  env?: Record<string, string | undefined>
  fetcher?: Fetcher
}

type PolarProduct = {
  id?: unknown
  name?: unknown
  description?: unknown
  prices?: unknown
  is_archived?: unknown
  is_recurring?: unknown
  recurring_interval?: unknown
  recurring_interval_count?: unknown
  visibility?: unknown
}

type PolarCheckoutLink = {
  url?: unknown
  checkout_url?: unknown
  public_url?: unknown
  permalink?: unknown
  client_secret?: unknown
  product_id?: unknown
  products?: unknown
  product?: unknown
}

type PolarPrice = {
  price_amount?: unknown
  amount?: unknown
  price_currency?: unknown
  currency?: unknown
  amount_type?: unknown
  type?: unknown
  recurring_interval?: unknown
  recurring_interval_count?: unknown
}

const endpoints = {
  production: 'https://api.polar.sh/v1',
  sandbox: 'https://sandbox-api.polar.sh/v1',
} as const

function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function bool(value: unknown) {
  return value === true
}

function number(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function checkoutLinkUrl(link: PolarCheckoutLink) {
  const direct = text(link.url) || text(link.checkout_url) || text(link.public_url) || text(link.permalink)
  if (direct) return direct

  const secret = text(link.client_secret)
  return secret ? `https://polar.sh/checkout/${encodeURIComponent(secret)}` : ''
}

function productIdsForLink(link: PolarCheckoutLink) {
  const ids = new Set<string>()
  const direct = text(link.product_id)
  if (direct) ids.add(direct)

  const product = link.product as { id?: unknown } | undefined
  const productId = text(product?.id)
  if (productId) ids.add(productId)

  for (const item of asArray(link.products)) {
    if (typeof item === 'string') ids.add(item)
    if (item && typeof item === 'object') {
      const product = item as { id?: unknown; product_id?: unknown; product?: { id?: unknown } }
      const id = text(product.id) || text(product.product_id) || text(product.product?.id)
      if (id) ids.add(id)
    }
  }
  return ids
}

function firstPrice(product: PolarProduct): PolarPrice | undefined {
  return asArray(product.prices).find((price): price is PolarPrice => !!price && typeof price === 'object')
}

function formatPrice(price: PolarPrice | undefined) {
  if (!price) return ''
  const amountType = text(price.amount_type) || text(price.type)
  if (amountType === 'free') return 'Free'
  if (amountType === 'custom') return 'Pay What You Want'

  const amount = number(price.price_amount) ?? number(price.amount)
  const currency = (text(price.price_currency) || text(price.currency) || 'usd').toUpperCase()
  if (amount === undefined) return ''

  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    maximumFractionDigits: amount % 100 === 0 ? 0 : 2,
  }).format(amount / 100)
}

function interval(product: PolarProduct, price: PolarPrice | undefined) {
  const value = text(price?.recurring_interval) || text(product.recurring_interval)
  const count = number(price?.recurring_interval_count) ?? number(product.recurring_interval_count)
  if (!value) return ''
  return count && count > 1 ? `Every ${count} ${value}s` : value
}

function slug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

async function api(path: string, options: Required<PolarOptions>, token: string, base: string) {
  const res = await options.fetcher(`${base}${path}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) {
    throw new BuildError(`Polar API request failed: ${res.status} ${res.statusText}`, {
      hint: `Check POLAR_ACCESS_TOKEN permissions and ${path}.`,
    })
  }
  return res.json() as Promise<{ items?: unknown[]; pagination?: { page?: number; max_page?: number; total_pages?: number } }>
}

async function list(path: string, options: Required<PolarOptions>, token: string, base: string) {
  const out: unknown[] = []
  let page = 1
  while (true) {
    const sep = path.includes('?') ? '&' : '?'
    const data = await api(`${path}${sep}limit=100&page=${page}`, options, token, base)
    out.push(...asArray(data.items))
    const max = data.pagination?.max_page ?? data.pagination?.total_pages ?? page
    if (page >= max) break
    page++
  }
  return out
}

export async function polarProductsData(opts: PolarOptions = {}): Promise<TemplateContext> {
  const options = { env: process.env, fetcher: fetch, ...opts }
  const token = options.env.POLAR_ACCESS_TOKEN ?? options.env.POLAR_OAT
  if (!token) {
    throw new BuildError('POLAR_ACCESS_TOKEN missing for <Products source="polar" />', {
      hint: 'Create a Polar Organization Access Token and expose it only to the build environment.',
    })
  }

  const server = options.env.POLAR_SERVER === 'sandbox' ? 'sandbox' : 'production'
  const base = endpoints[server]
  const org = options.env.POLAR_ORGANIZATION_ID
  const orgQuery = org ? `&organization_id=${encodeURIComponent(org)}` : ''

  const [rawProducts, rawLinks] = await Promise.all([
    list(`/products?is_archived=false&visibility=public${orgQuery}`, options, token, base),
    list(`/checkout-links?${org ? `organization_id=${encodeURIComponent(org)}` : ''}`, options, token, base),
  ])

  const linksByProduct = new Map<string, string>()
  for (const raw of rawLinks) {
    if (!raw || typeof raw !== 'object') continue
    const link = raw as PolarCheckoutLink
    const url = checkoutLinkUrl(link)
    if (!url) continue
    for (const id of productIdsForLink(link)) linksByProduct.set(id, url)
  }

  const products = rawProducts
    .filter((raw): raw is PolarProduct => !!raw && typeof raw === 'object')
    .filter((product) => !bool(product.is_archived))
    .map((product) => {
      const id = text(product.id)
      const name = text(product.name)
      const price = firstPrice(product)
      const checkout = linksByProduct.get(id) ?? ''
      return {
        id,
        slug: slug(name || id),
        name,
        description: text(product.description),
        price: formatPrice(price),
        interval: interval(product, price),
        recurring: bool(product.is_recurring) ? 'true' : '',
        href: checkout,
        cta: checkout ? 'Buy Now' : 'View Product',
      } satisfies Record<string, TemplateValue>
    })
    .filter((product) => product.id && product.name)

  return { products }
}
