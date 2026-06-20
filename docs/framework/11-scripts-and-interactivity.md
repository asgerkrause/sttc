# Scripts and interactivity

SANITIZE Boilerplate has no runtime JS framework, virtual DOM, or hydration. Browser behavior comes from:

- `runtime/router.js` framework runtime;
- `src/app.ts` shared site code;
- top route `<script>` blocks;
- component `<script>` blocks.

Build bundles app code with Bun and appends shell head scripts, component lifecycle scripts, and route top scripts into hashed output.

## Shared app code

Use `src/app.ts` for behavior shared across pages.

```ts
// src/app.ts
document.addEventListener('snz:page', (event) => {
  console.log('page changed', event.detail.slug)
})
```

`src/app.js` works as an escape hatch. Do not keep both `src/app.ts` and `src/app.js`; build fails on ambiguous root entries. Legacy `src/app/app.js` still works only when no root app entry exists.

Only `PUBLIC_*` environment variables are inlined.

## Router API

Available as `window.snz`:

```js
snz.navigate('/about/')
snz.page()
snz.onPage('about', ({ main, slug, pathname }) => {})
snz.onPage('*', ({ main, slug, pathname }) => {})
snz.prefetch('/contact/')
snz.beforeNavigate(({ pathname, slug }) => true)
snz.afterNavigate(({ main, slug, pathname }) => {})
snz.track('CTA clicked', { location: 'hero' })
```

`onPage` fires immediately when current page matches. It returns unsubscribe.

```js
const off = snz.onPage('pricing', ({ main }) => {
  main.querySelector('[data-plan]')?.focus()
})

// later
 off()
```

`beforeNavigate` may return `false` to cancel navigation.

```js
snz.beforeNavigate(() => {
  if (!window.formDirty) return true
  return confirm('Leave without saving?')
})
```

## Page event

Router dispatches `snz:page` after main content swaps.

```ts
document.addEventListener('snz:page', (event) => {
  const { main, slug, pathname } = event.detail
  console.log(slug, pathname, main)
})
```

Use this for small progressive enhancements that need fresh DOM after navigation.

## Route scripts

A route may include top-level `<script>`. Build wraps it with that route slug.

```html
<script>
  const root = document.querySelector('[data-route-root]')
  const form = root?.querySelector('[data-contact]')
  form?.addEventListener('submit', (event) => {
    event.preventDefault()
  })
</script>

<Section>
  <form data-contact>...</form>
</Section>
```

Use route scripts for page-only behavior. Use `src/app.ts` when behavior appears on multiple pages.

## Component scripts

Use component `<script>` when behavior belongs to component instance.

```html
<!-- src/components/Tabs.html -->
<div class="tabs">{{slot}}</div>

<script>
  const buttons = el.querySelectorAll('[role="tab"]')
  const onClick = (event) => {
    const button = event.target.closest('[role="tab"]')
    if (!button) return
    // update tab state
  }
  el.addEventListener('click', onClick)
  return () => el.removeEventListener('click', onClick)
</script>
```

Runtime mounts component scripts after each navigation and runs returned cleanup before old route DOM is removed.

## Disclosure behavior

Any button with `aria-controls` and `aria-expanded` toggles automatically:

```html
<button type="button" aria-expanded="false" aria-controls="nav">
  Menu
</button>
<nav id="nav">...</nav>
```

Escape closes open disclosure and returns focus. Add `data-snz-ignore` to opt out.

```html
<button type="button" aria-expanded="false" aria-controls="custom" data-snz-ignore>
  Custom toggle
</button>
```

## Link handling and preload

Router intercepts eligible same-origin links and swaps route content.

Native behavior remains for:

- external links;
- downloads;
- non-left clicks;
- command/control/shift/alt clicks;
- non-`_self` targets;
- same-page hash links.

Same-origin links preload after hover/focus intent. Disable per link:

```html
<a href="/large/" data-snz-preload="off">Large page</a>
```

## Tracking

Components can emit simple marketing events with `track` attr when supported by component contract.

```html
<Button href="/contact/" label="Book call" track="CTA clicked" />
```

Runtime reads `data-snz-track`. `snz.track(event, data)` calls Vercel Analytics when `window.va` exists. Otherwise it dispatches `snz:track` for custom adapters.

```js
document.addEventListener('snz:track', (event) => {
  const { event: name, data } = event.detail
  console.log(name, data)
})
```

## Scroll

Set scroll mode in `src/site.json`:

```json
{ "scroll": "lenis" }
```

`"lenis"` loads self-hosted Lenis unless user prefers reduced motion. `"native"` skips it.

Router resets to top after navigation. It uses Lenis when present, otherwise native `window.scrollTo(0, 0)`.

## TypeScript

Starter projects include `src/snz.d.ts` for typed `window.snz`, `snz:page`, and tracking events. Author code can import modules directly from `src/app.ts`.

## Build

```bash
bun run build
```

Use build/check output as source of truth. Fix source files, not generated `dist/` files.

## Next

[Client router](./10-client-router.md) · [Docs home](./README.md) · [Forms and embeds](./12-forms-and-embeds.md)
