import assert from 'node:assert/strict'
import type { Browser, BrowserContextOptions, Page } from 'playwright-core'

declare global {
  interface Window {
    browserProbe: { pages: string[]; tracks: unknown[]; id: string }
  }
}

export async function inPage(browser: Browser, url: string, run: (page: Page) => Promise<void>, options: BrowserContextOptions = {}, allow404 = false) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce', ...options })
  const errors: string[] = []
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(url).origin ? route.continue() : route.abort())
  await context.addInitScript(() => {
    window.browserProbe = { pages: [], tracks: [], id: crypto.randomUUID() }
    document.addEventListener('snz:page', event => window.browserProbe.pages.push(event.detail.slug))
    document.addEventListener('snz:track', event => window.browserProbe.tracks.push(event.detail))
    document.addEventListener('DOMContentLoaded', () => document.documentElement.classList.add('js'))
  })
  try {
    const page = await context.newPage()
    page.setDefaultTimeout(4_000)
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => {
      if (message.type() === 'error' && !(allow404 && message.text().includes('404 (Not Found)'))) errors.push(message.text())
    })
    await run(page)
    assert.deepEqual(errors, [], 'browser console/uncaught errors')
  } finally {
    await context.close()
  }
}

export async function mounts(page: Page, url: string, path = '/') {
  await page.goto(url + path)
  await page.getByRole('button', { name: 'Track', exact: true }).waitFor()
  assert.equal(await page.locator('header').getAttribute('data-mounts'), '1', 'header mounts once')
  assert.equal(await page.locator('article').getAttribute('data-mounts'), '1', 'main mounts once')
  assert.deepEqual(await page.evaluate(() => window.browserProbe.pages), [path === '/' ? 'index' : 'docs'], 'page event once')
}

export async function disclosure(page: Page, url: string) {
  await mounts(page, url)
  const menu = page.getByRole('button', { name: 'Menu', exact: true })
  await menu.focus()
  await page.keyboard.press('Enter')
  assert.equal(await menu.getAttribute('aria-expanded'), 'true', 'keyboard opens disclosure')
  const link = page.getByRole('link', { name: 'Docs', exact: true })
  await link.focus()
  await page.keyboard.press('Escape')
  assert.equal(await menu.getAttribute('aria-expanded'), 'false', 'Escape closes disclosure')
  assert.equal(await menu.evaluate(el => el === document.activeElement), true, 'Escape restores focus')
  await page.keyboard.press('Space')
  await page.getByRole('link', { name: 'Jump', exact: true }).click()
  assert.equal(await menu.getAttribute('aria-expanded'), 'false', 'anchor closes disclosure')
  await page.waitForFunction(() => location.hash === '#target' && scrollY > 0)
}

export async function reducedMotion(page: Page, url: string) {
  await mounts(page, url)
  assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true)
  assert.equal(await page.evaluate(() => 'lenis' in window), false, 'reduced motion excludes Lenis')
  assert.equal(await page.locator('script[src*="vendor/lenis"],link[href*="lenis.css"]').count(), 0, 'reduced motion loads no Lenis assets')
  await page.getByRole('link', { name: 'Go to target' }).click()
  await page.waitForFunction(() => location.hash === '#target' && scrollY > 0)
}

export function cases(browser: Browser, url: string) {
  return [
    ['mounts, page and track events', () => inPage(browser, url, async page => {
      await mounts(page, url)
      await page.getByRole('button', { name: 'Track', exact: true }).click()
      await page.evaluate(() => window.snz.track('API', { value: 7 }))
      assert.deepEqual(await page.evaluate(() => window.browserProbe.tracks), [{ event: 'Probe', data: { location: 'main' } }, { event: 'API', data: { value: 7 } }])
      assert.deepEqual(await page.evaluate(() => window.browserProbe.pages), ['index'])
    })],
    ['keyboard disclosure, Escape focus and anchor', () => inPage(browser, url, page => disclosure(page, url))],
    ['native navigation and direct directory assets', () => inPage(browser, url, async page => {
      await mounts(page, url, '/docs/')
      assert.equal(await page.locator('#intro').evaluate(el => getComputedStyle(el).minHeight), '1080px')
      const id = await page.evaluate(() => window.browserProbe.id)
      await page.getByRole('link', { name: 'Home', exact: true }).click()
      await page.waitForURL(url + '/')
      await page.waitForLoadState('load')
      assert.notEqual(await page.evaluate(() => window.browserProbe.id), id, 'navigation creates a document')
      assert.equal(await page.locator('header').getAttribute('data-mounts'), '1')
      assert.deepEqual(await page.evaluate(() => window.browserProbe.pages), ['index'])
      await page.getByRole('link', { name: 'Read docs' }).click()
      await page.waitForURL(url + '/docs/')
      await page.waitForLoadState('load')
      assert.deepEqual(await page.evaluate(() => window.browserProbe.pages), ['docs'])
    })],
    ['missing route serves site 404', () => inPage(browser, url, async page => {
      assert.equal((await page.goto(url + '/missing-page/'))?.status(), 404)
      await page.getByRole('heading', { name: 'Fixture not found' }).waitFor()
    }, {}, true)],
    ['no-JS content and native links', () => inPage(browser, url, async page => {
      await page.goto(url + '/')
      await page.getByRole('heading', { name: 'Home', exact: true }).waitFor()
      await page.getByRole('link', { name: 'Docs', exact: true }).click()
      await page.waitForURL(url + '/docs/')
      await page.getByRole('heading', { name: 'Docs', exact: true }).waitFor()
      await page.getByRole('link', { name: 'Go to target' }).click()
      await page.waitForFunction(() => location.hash === '#target' && scrollY > 0)
    }, { javaScriptEnabled: false })],
    ['reduced motion retains native scrolling with JS', () => inPage(browser, url, page => reducedMotion(page, url))],
    ['normal motion activates real Lenis', () => inPage(browser, url, async page => {
      await mounts(page, url)
      await page.waitForFunction(() => 'lenis' in window && document.documentElement.classList.contains('lenis'))
    }, { reducedMotion: 'no-preference' })],
  ] satisfies [string, () => Promise<void>][]
}
