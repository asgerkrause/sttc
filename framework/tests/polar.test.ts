import { describe, expect, test } from 'bun:test'
import { polarProductsData } from '../build/polar'
import { BuildError } from '../build/errors'

function json(data: unknown) {
  return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } })
}

describe('Polar products', () => {
  test('normalizes public products and checkout links', async () => {
    const calls: string[] = []
    const data = await polarProductsData({
      env: { POLAR_ACCESS_TOKEN: 'polar_oat_test' },
      fetcher: (async (url: string) => {
        calls.push(url)
        if (url.includes('/products')) {
          return json({
            items: [{
              id: 'prod_1',
              name: 'Starter',
              description: 'Good first offer.',
              prices: [{ price_amount: 2900, price_currency: 'usd', recurring_interval: 'month' }],
            }],
            pagination: { page: 1, max_page: 1 },
          })
        }
        return json({
          items: [{ url: 'https://polar.sh/checkout/link', products: [{ id: 'prod_1' }] }],
          pagination: { page: 1, max_page: 1 },
        })
      }) as typeof fetch,
    })

    expect(calls).toHaveLength(2)
    expect(data.products).toEqual([{ id: 'prod_1', slug: 'starter', name: 'Starter', description: 'Good first offer.', price: '$29', interval: 'month', recurring: '', href: 'https://polar.sh/checkout/link', cta: 'Buy Now' }])
  })

  test('requires server-only Polar token', async () => {
    await expect(polarProductsData({ env: {}, fetcher: fetch })).rejects.toThrow(BuildError)
  })
})
