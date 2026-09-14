# Runtime

Navigation is native. The build emits one full HTML document per route, so every link is an ordinary document load: the browser restores scroll on back, anchors such as `/faq/#pricing` scroll on arrival, and a deploy is live on the next click. There is no fragment fetch, head merge, announcer, or focus management, and `window.snz` has no navigation call, prefetch call, or navigation hook.

Two pieces of the shell make that feel fast:

- cross-document view transitions come from CRFT `motion.css` in the project's own `src/styles/`;
- a `<script type="speculationrules">` block in `src/shell.html` prefetches same-origin documents with `eagerness: "moderate"`.

Both are project source. Edit or delete them without touching the renderer.

## Page runtime

The build ships `framework/runtime/router.js` as a hashed `/assets/js/router.[hash].js`. It mounts component lifecycle scripts, reports the page, tracks events, watches visibility and active media, and handles native disclosures. Starter sites include `src/snz.d.ts` with its types.

Available as `window.snz`:

```js
snz.page()
snz.onPage('about', fn)
snz.onPage('*', fn)
snz.track('Contact CTA', { location: 'header' })
snz.onVisible(el, { enter, exit, change, threshold, margin })
snz.onActive(el, { enter, exit, change, threshold, margin })
snz.isVisible(el)
snz.isActive(el)
snz.registerComponent('Name', (el) => cleanup)
```

- `page()` returns the current slug from `<html data-snz-route>`.
- `onPage(slug, fn)` runs once when the document activates and `slug` matches; `'*'` matches every page. A handler registered after activation runs on the next microtask.
- `track(event, data)` dispatches `snz:track` on `document`.
- `onVisible` and `onActive` observe an element with `IntersectionObserver`; `onActive` also goes inactive while the tab is hidden. `isVisible` and `isActive` answer synchronously.
- `registerComponent(name, fn)` registers a mount function for `data-snz-component="Name"` roots and mounts any that are already in the document. The build registers each component lifecycle script through the same function, exposed as `_registerComponent`.

Each hook returns an unsubscribe function.

## `snz:page`

The runtime activates the page on `DOMContentLoaded`: it mounts components inside `body > main`, marks the current nav link with `aria-current="page"`, runs `onPage` handlers, then dispatches one `snz:page` event on `document`:

```js
document.addEventListener('snz:page', (event) => {
  const { slug, pathname, main } = event.detail
})
```

The event fires once per document. Prefer `snz.onPage` when the listener may attach late; it replays for the current page.

## Route scripts

A `<script>` at the top of an authored route is extracted and wrapped with `snz.onPage('{slug}', ...)` in the hashed app bundle, so it runs when that route is the document:

```html
<script>
  console.log('runs on this route')
</script>

<Section>
  <h1>Route</h1>
</Section>
```

Rules:

- a route `<script>` must be at the top of the file; one lower in the body fails the build;
- move shared logic to `src/app.ts`;
- do not keep both `src/app.ts` and `src/app.js`.

## App entry

`src/app.ts` is the canonical entry and may import local TypeScript or JavaScript. `src/app.js` is an escape hatch; both cannot coexist. `Bun.build` bundles it, then the build appends shell inline scripts, component lifecycle registrations, and route scripts. Only `PUBLIC_*` environment variables are inlined; keep secrets out of `PUBLIC_*`.

## Component lifecycle

An executable component `<script>` runs per instance with `el` bound to the component root. Return cleanup. Active work must use `snz.onActive` or `snz.onVisible`. Autoplay `<video>` and `<audio>` pause when they leave the viewport or the tab hides and resume when they return; `data-active="manual"` on the element or an ancestor opts out. See [Components](./components.md).

## Native disclosure

Buttons with `aria-controls` and `aria-expanded` toggle `aria-expanded` on click. Escape closes the open control and focuses it. A click on a same-origin link inside a `nav[id]` or `<header>` closes that navigation's disclosure, because a same-document anchor does not unload the page. Add `data-snz-ignore` to opt out.

```html
<button aria-controls="site-nav" aria-expanded="false">Menu</button>
<nav id="site-nav">...</nav>
```

## `snz:track` and analytics

Components with `track="Event name"` compile to `data-snz-track="Event name"`. A click on that element, or on a disclosure button that carries it, calls `snz.track(event)`; an optional hand-written `data-snz-track-location` attribute arrives as `data.location`. `snz.track()` always dispatches `snz:track`; the runtime knows no analytics provider and injects no script. Providers subscribe in `src/app.ts`.

PostHog, with `history_change` pageviews from the `2025-05-24` defaults:

```ts
import posthog from 'posthog-js'

posthog.init('phc_project_token', {
  api_host: 'https://eu.i.posthog.com',
  defaults: '2025-05-24',
})

document.addEventListener('snz:track', (event) => {
  posthog.capture(event.detail.event, event.detail.data)
})
```

Set `cookieless_mode: 'always'` in the `init` options for an EU site that must not set cookies without consent; PostHog then tracks without cookies or local storage.

Vercel Analytics, after the site loads the Vercel script (declare `va` on `Window` in `src/snz.d.ts`):

```ts
document.addEventListener('snz:track', (event) => {
  window.va?.('event', { name: event.detail.event, data: event.detail.data })
})
```

Both recipes are illustrative: install the provider package or script yourself, and keep keys that are not public out of `PUBLIC_*`.

## Scroll and transitions

Scroll position is the browser's. Lenis smooth scrolling is optional and self-hosted: `"scroll": "lenis"` in `src/site.json` emits its bootstrap, stylesheet, and vendor script; `"scroll": "native"` omits them. Reduced-motion users always keep native scrolling. Lenis stops wheel inertia when an internal link is clicked so the coast does not run on while the next document loads.

Transition presentation is ordinary project-owned CSS in `src/styles/layers/motion.css`. The runtime adds no transition CSS and no transition attribute.
