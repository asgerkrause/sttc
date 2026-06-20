# Pages and routing

Routes are HTML files. One file becomes one public URL.

```txt
src/pages/index.html        /
src/pages/about.html        /about/
src/pages/work/case.html    /work/case/
src/pages/blog/index.html   /blog/
src/pages/404.html          /404/
```

`src/pages` is current route source. `src/routes` still works for legacy projects, but `src/pages` wins on same public slug.

## Add a page

Use scaffold:

```bash
bun run new route pricing
```

Or create file directly:

```html
<!-- src/pages/pricing.html -->
<head>
  <SEO title="Pricing" description="Clear plans for modern teams." />
</head>

<Section>
  <h1>Pricing</h1>
  <p>Choose plan.</p>
</Section>
```

Run:

```bash
bun run build
```

Build emits route body, sitemap entry, manifest entry, llms entry, and `/routes/pricing.json`.

## Route file shape

Route files are body markup. Optional top `<head>` block controls per-route head data.

```html
<head>
  <SEO title="About" description="What we do and why." />
  <meta name="snz:transition" content="fade">
</head>

<Section>
  <h1>About</h1>
  <p>Page body.</p>
</Section>
```

Allowed transition values:

```html
<meta name="snz:transition" content="fade">
<meta name="snz:transition" content="slide">
<meta name="snz:transition" content="none">
```

Router sets `html[data-transition="..."]` during navigation.

## SEO

Use `<SEO>` once inside route `<head>` when page needs custom title, description, canonical path, or OG image.

```html
<head>
  <SEO
    title="Work"
    description="Selected projects and outcomes."
    path="/work/"
    ogImage="/assets/og.webp"
  />
</head>
```

If omitted, defaults come from `src/site.json` and shell default SEO.

## Links

Use normal same-origin links:

```html
<a href="/about/">About</a>
<Button href="/contact/" label="Contact" />
```

Same-origin links navigate through `runtime/router.js`. External links, downloads, hash links on current page, modified clicks, and non-`_self` targets stay native.

## Preload

Same-origin links preload after hover/focus intent. Touch starts preload immediately.

Disable preload per link:

```html
<a href="/heavy/" data-snz-preload="off">Heavy page</a>
```

Router cache keeps fresh route HTML for 5 minutes and clears after long background sessions.

## Inline route scripts

A route may include one top-level `<script>` block. Build wraps it with page scope.

```html
<script>
  const form = document.querySelector('[data-signup]')
  form?.addEventListener('submit', (event) => {
    event.preventDefault()
  })
</script>

<Section>
  <form data-signup>...</form>
</Section>
```

Use `src/app.ts` for shared behavior. Use component `<script>` for behavior owned by one component.

## No route styles

`<style>` inside route files is forbidden. Use:

- component `<style>` for component-owned selectors;
- `html[data-page="slug"]` in global CSS for page-only overrides.

```css
html[data-page="pricing"] .pricing-note {
  color: var(--g);
}
```

## Slug collisions

Authored pages, legacy routes, CMS content, and generated routes share one public slug registry. Duplicate public URLs fail build loudly. Rename source file or route config instead of editing `dist/`.

## Next

[Project structure](./02-project-structure.md) · [Docs home](./README.md) · [Shell](./04-shell.md)
