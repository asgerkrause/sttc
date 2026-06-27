# Shell

`src/shell.html` is app wrapper. It loads once, then router swaps route bodies into `<main data-route-root>`.

Default shell:

```html
<!doctype html>
<html lang="en" data-scroll="{{scroll}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <SEO path="/" />
  <link rel="stylesheet" href="/assets/css/styles.css">
  <!-- @snz-components-css -->
  <script src="/router.js" type="module"></script>
  <script src="/assets/js/scroll.js" defer></script>
  <script src="/assets/js/app.js" type="module"></script>
</head>
<body>
  <Header />
  <main data-route-root></main>
  <Footer />
  <div data-snz-announcer aria-live="polite" aria-atomic="true"></div>
</body>
</html>
```

## Keep in shell

Use shell for site-wide chrome and assets:

- document doctype, `<html>`, `<head>`, and `<body>`;
- global CSS link;
- component CSS insertion marker;
- router script;
- built app script;
- persistent header/footer;
- one `<main data-route-root>`;
- route announcer for navigation accessibility.

## Route root

Router requires one main route mount:

```html
<main data-route-root></main>
```

On navigation, router fetches `/routes/{slug}.html`, merges route head metadata, unmounts old component scripts, replaces main children, mounts new component scripts, resets scroll, updates nav current state, then emits page events.

## Component CSS marker

Keep marker in `<head>`:

```html
<!-- @snz-components-css -->
```

Build replaces it with hashed component stylesheet link when component styles exist. Component CSS loads after global CSS, so equal-specificity component rules win.

## Header and footer

Default shell uses components:

```html
<Header />
<Footer />
```

Edit `src/components/Header.html` and `src/components/Footer.html` for site chrome. Keep route-specific content in `src/pages`.

## Navigation state

Router adds `aria-current="page"` to matching same-origin nav links.

```html
<nav id="nav">
  <a href="/">Home</a>
  <a href="/about/">About</a>
</nav>
```

For disclosure navigation, use normal accessible controls:

```html
<button type="button" aria-expanded="false" aria-controls="nav">Menu</button>
<nav id="nav">...</nav>
```

Any `button[aria-controls][aria-expanded]` toggles automatically unless it has `data-snz-ignore`. Escape closes open disclosure and returns focus.

## Route announcer

Keep announcer element for assistive tech:

```html
<div data-snz-announcer aria-live="polite" aria-atomic="true"></div>
```

After navigation, router announces first `h1`, first `h2`, first `[role="heading"]`, or document title.

## Scroll mode

Shell exposes configured scroll mode:

```html
<html lang="en" data-scroll="{{scroll}}">
```

Set mode in `src/site.json`:

```json
{ "scroll": "lenis" }
```

Use `"native"` to skip Lenis. Router scroll reset uses `window.lenis.scrollTo(0, { immediate: true, force: true })` when available, else `window.scrollTo(0, 0)`.

## Scripts

Do not add page-specific scripts to shell. Put shared code in `src/app.ts`, route-only code in top route `<script>`, and component code in component `<script>`.

Only `PUBLIC_*` env vars are inlined into bundled app code.

## Next

[Pages and routing](./03-pages-and-routing.md) · [Docs home](./README.md) · [Components](./05-components.md)
