# Client router

STTC ships static HTML plus a small client router at `framework/runtime/router.js`. It swaps route bodies into the shell and exposes `window.snz`.

## Shell and routes

Build output uses:

```txt
src/shell.html          -> dist/index.html
src/pages/about.html    -> dist/routes/about.html
```

The shell loads once. Same-origin navigation fetches route HTML from `/routes/{slug}.html` and injects it into the shell's `body > main`.

Route files contain body markup, not shell chrome.

## Browser API

Available as `window.snz`:

```js
snz.navigate('/about/')
snz.page()
snz.onPage('about', fn)
snz.onPage('*', fn)
snz.prefetch('/contact/')
snz.beforeNavigate(fn)
snz.afterNavigate(fn)
```

Behavior:

- `navigate(path)` changes route programmatically
- `page()` returns current slug
- `onPage(slug, fn)` runs when slug is active and fires immediately when already on that page
- `onPage('*', fn)` runs on every navigation
- `prefetch(path)` warms route HTML cache
- `beforeNavigate(fn)` may return `false` to cancel navigation
- `afterNavigate(fn)` runs after DOM swap and scroll handling

Each hook returns an unsubscribe function.

## Route scripts

Top-of-file route scripts are allowed. Build extracts them and wraps them with `snz.onPage('{slug}', ...)` in the hashed app bundle.

```html
<script>
  console.log('runs on this route')
</script>

<Section>
  <h1>Route</h1>
</Section>
```

Rules:

- route `<script>` must be at top
- route `<style>` is forbidden
- move shared logic to `src/app.ts`
- do not keep both `src/app.ts` and `src/app.js`

## App entry

`src/app.ts` is bundled with `Bun.build`. Starter sites include `src/snz.d.ts` with router/event types.

Only `PUBLIC_*` environment variables are inlined.

## Preload cache

Same-origin links preload on intent:

- hover/focus after about 100ms
- touchstart immediately
- in-flight requests dedupe
- cached HTML is reused on navigation

Skipped preload cases:

- current URL
- `data-snz-preload="off"`
- `download`
- non-`_self` targets
- metered/save-data connections

Cache is in memory. Full page reload clears it.

## Disclosure behavior

Buttons with `aria-controls` and `aria-expanded` toggle controlled regions. Escape closes open disclosure UI.

Use this pair for navigation disclosure:

```html
<button aria-controls="site-nav" aria-expanded="false">Menu</button>
<nav id="site-nav">...</nav>
```

Add `data-snz-ignore` to opt out of framework disclosure handling.

## Scroll and transitions

Route navigation resets with native `window.scrollTo(0, 0)`. Projects may add their own scrolling system without a framework coupling.

The router uses the native View Transitions API when available. Transition presentation is ordinary project-owned CSS in `src/styles.css`; edit or delete the marked route-transition block there. The router adds no transition CSS.

Projects that need route-specific treatments may set their own hook:

```html
<head>
  <meta name="snz:transition" content="project-detail">
</head>
```

The value becomes `html[data-transition="project-detail"]`. The framework provides no named visual variants.

## Tracking hook

Components with `track="Event name"` compile to `data-snz-track`. Router calls Vercel Analytics when `window.va` exists; otherwise it emits a `snz:track` event for custom adapters.

```js
document.addEventListener('snz:track', (event) => {
  console.log(event.detail.event, event.detail.data)
})
```

Analytics scripts are not injected automatically.

## Next

[SEO, AEO, and GEO](./09-seo-aeo-geo.md) · [Docs home](./README.md) · [Scripts and interactivity](./11-scripts-and-interactivity.md)
