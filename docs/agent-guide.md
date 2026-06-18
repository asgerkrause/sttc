# Agent Guide

Fast orientation for LLMs working in SANITIZE Boilerplate (`@snz/bp`).

## Mental model

SANITIZE Boilerplate (`@snz/bp`) is an HTML-first, Bun-native static site builder.

```txt
src/shell.html          app shell, loaded once
src/pages/**/*.html       route bodies, fetched by router
src/components/*.html   build-time components with inline schema
content/**/*.md         CMS content, rendered through templates
dist/                   generated static site, never edit
```

Build flow:

1. Parse components from `src/components/*.html`.
2. Compose route/body HTML from `src/pages/**/*.html` and content markdown.
3. Extract component styles/scripts into hashed assets.
4. Process images with `Bun.Image`.
5. Emit discovery artifacts: sitemap, feeds, llms files, manifest, route JSON.
6. Run strict checks.

No runtime framework. No hydration. No npm dependency model. Bun only.

## Golden rules

| Do | Don't |
|---|---|
| Edit `src/`, `content/`, `media/`, `docs/`, `build/` when needed. | Edit `dist/`; generated and gitignored. |
| Use Bun commands. | Add npm/Vite/framework assumptions. |
| Put component CSS in component `<style>`. | Put `.card`, `.faq`, `.code`, private roots in `styles.css`. |
| Use `.c`, `.w`, `[g]`, `[c]`, `[r]`, `[o]` as global primitives. | Recreate grid/stack utility classes. |
| Use semantic HTML first. | Add wrapper/classes without need. |
| Run `bun run build` after structural edits. | Claim success without build/check evidence. |

## Common tasks

### Add route

```bash
bun run new route pricing
```

Or create `src/pages/pricing.html`:

```html
<head>
  <SEO title="Pricing" description="Clear plans for modern teams." />
</head>

<Section>
  <h1>Pricing</h1>
  <p>Choose plan.</p>
</Section>
```

URL becomes `/pricing/`. Build also emits sitemap, manifest, llms, and `/routes/pricing.json` entries.

### Add component

Create `src/components/FeatureCard.html`:

```html
<!--
  @desc Feature card with heading, body, and optional link.
  @attr title! Heading text.
  @attr href Optional CTA URL.
  @attr variant=[default|accent] :class Visual style.
-->
<article class="feature-card">
  <h2>{{title}}</h2>
  <div>{{slot}}</div>
  <a class="lnk" href="{{href}}">Learn more</a>
</article>

<style>
  .feature-card {
    padding: var(--pd);
    border: var(--bw) solid var(--b);
    border-radius: var(--br);
  }

  .feature-card.accent {
    background: var(--a05);
  }
</style>
```

Use it in routes as `<FeatureCard title="Fast">Body</FeatureCard>`.

### Add layout

Use primitives directly:

```html
<div g="4-2">
  <article c="2-1">Feature</article>
  <article>Small item</article>
</div>
```

Or via component:

```html
<Grid cols="4-2">
  <Card title="One">...</Card>
  <Card title="Two">...</Card>
</Grid>
```

`Grid span/rows/order` only when `<Grid>` itself is a child of another grid.

### Add stack/wrap rhythm

Use `.w`:

```html
<div class="w">
  <h2>Heading</h2>
  <p>Body.</p>
  <Button href="/contact/" label="Contact" />
</div>
```

`Stack` exists only for backwards compatibility. Prefer `.w`.

### Add image

Place master in `src/images/hero.png` or a PagesCMS `media.input` image root (default `media/images/hero.png`), then:

```html
<Image src="hero" alt="Product interface" max="1200" loading="eager" />
```

Build emits responsive WebP variants under `/assets/images/`. Keep each logical basename unique across image roots.

### Add inline markdown

Use `<Markdown>` for build-time markdown inside routes/components:

```html
<Markdown>
## Feature table

| Feature | Status |
| --- | --- |
| Tables | Supported |

<Button label="Contact" href="/contact/" />
</Markdown>
```

Markdown is rendered at build time. Unsafe HTML and unsafe URL protocols fail loudly.

### Add CMS content

CMS is opt-in. Scaffold the content surface first:

```bash
bun run new cms
```

Then add markdown. `content/pages/about.md` → `/about/`.

```md
---
title: About
description: Why this exists.
---

Markdown body.
```

`content/posts/name.md` → `/insights/name/`. Drafts excluded from production builds.

## CSS ownership

Global CSS files:

- `src/styles.css` — tokens, reset/base/type, theme tokens, `.c`, `.w`, `[g]`, `[c]`, `[r]`, `[o]`, page overrides.
- Legacy support: `src/styles/styles.css`, `src/styles/grid.css`, and `src/styles/lenis.css` can still be used.

Component CSS:

- Lives inside component file `<style>`.
- Bundled to `dist/assets/css/components.{hash}.css`.
- Loads after global CSS.

Audit boundary:

```bash
bun run css:audit
bun run doctor
```

## Component contract

- One component = one `src/components/PascalCase.html` file.
- Leading HTML comment declares schema.
- `@attr name!` means required.
- `@attr variant=[a|b] :class` appends variant value to root class.
- `{{slot}}` receives children.
- `<slot name="x">...</slot>` fills `{{slot:x}}`.
- Optional `<script>` runs per instance with `el` bound to root.
- Optional `@schema Type field=attr` emits JSON-LD.

Full contract: `docs/components.md`.

## Route rules

- Route files are body markup.
- Optional top `<head>...</head>` wrapper supports SEO and transition meta.
- Inline `<script>` allowed only at top of route; build wraps it in `snz.onPage('{slug}', ...)`.
- `<style>` in routes is forbidden. Use component style or `html[data-page="slug"]` in `styles.css`.
- Authored/content/generated routes share one slug registry. Duplicate public slugs fail loudly; `src/pages` only replaces legacy `src/routes` for the same slug.

## App scripts

`src/app.js` or `src/app.ts` is bundled with `Bun.build`, so author code can use imports and TypeScript. Shell head scripts, component lifecycle scripts, and route top scripts are appended to the same hashed `dist/assets/js/app.{hash}.js` output. Only `PUBLIC_*` env vars are inlined.

## Router API

Available in browser as `window.snz`:

```js
snz.navigate('/about/')
snz.page()
snz.onPage('about', fn)
snz.onPage('*', fn)
snz.prefetch('/contact/')
snz.beforeNavigate(fn)
snz.afterNavigate(fn)
```

## Build/check loop

Use smallest command that proves change:

```bash
bun run build      # full build + strict checks
bun run check      # rebuild + validate
bun run css:audit  # CSS ownership only
bun run doctor     # css audit + check
```

Build errors should include file, line, and hint. Fix source, not `dist/`.

## Before shipping answer

Minimum evidence for code/docs changes:

- Structural/component/build changes: `bun run build`.
- CSS ownership changes: `bun run doctor`.
- Docs-only change: no command required unless links/generated docs touched.

Report exact commands run and result.
