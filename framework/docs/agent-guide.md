# Agent Guide

Fast orientation for LLMs working in SANITIZE Boilerplate (`@snz/bp`).

Need an end-to-end client build path? Read `framework/docs/client-site-playbook.md`.
Need task cards? Read `framework/docs/agent-recipes.md`.
Need built-in component contracts/examples? Read generated `framework/docs/components-catalog.md`.

## Mental model

SANITIZE Boilerplate (`@snz/bp`) is an HTML-first, Bun-native static site framework. Authors edit normal HTML/CSS/JS/markdown; Bun compiles it into static files with routing, components, images, SEO, feeds, llms files, and discovery JSON.

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

No third-party runtime framework. No virtual DOM. No hydration. No npm dependency model. Bun only. The client framework is `framework/runtime/router.js`, exposed as `window.snz` for navigation, route cache, page hooks, and component lifecycle mounting.

## Golden rules

| Do | Don't |
|---|---|
| Edit `src/` and `content/` for site work. Edit `framework/` for engine work. | Edit `dist/`; generated and gitignored. |
| Use Bun commands. | Add npm/Vite/framework assumptions. |
| Put component CSS in component `<style>`. | Put `.faq`, `.code`, private roots in `styles.css`. |
| Use `.c`, `.w`, `[g]`, `[c]`, `[r]`, `[o]` as global primitives. | Recreate grid/stack utility classes. |
| Use semantic HTML first. | Add wrapper/classes without need. |
| Run `bun run build` after structural edits. Keep `.snz/` cache/state only. | Claim success without build/check evidence or put source in `.snz/`. |

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

Add a private slot-first preset when a common landing-page pattern is enough:

```bash
snz-bp add component hero         # Hero.html
snz-bp add component cta          # CTA.html
snz-bp add component features     # Features.html + Feature.html
snz-bp add component partners     # Partners.html + Partner.html
snz-bp add component pricing      # Pricing.html + Plan.html
snz-bp add component testimonials # Testimonials.html + Testimonial.html
snz-bp add component stats        # Stats.html + Stat.html
snz-bp add component process      # Process.html + Step.html
snz-bp add component faq          # Questions.html
snz-bp add component hero --demo  # also append <Section><Hero /></Section>
```

Presets write normal PascalCase component files under `src/components/` and refuse to overwrite existing files unless `--force` is passed. Add `--demo` to append invocation to `src/pages/styles.html` or legacy `src/routes/styles.html` when present. Prefer content nouns: plural wrappers (`Features`, `Testimonials`, `Partners`) and singular items (`Feature`, `Testimonial`, `Partner`). Keep presets slot-first so existing `Grid`, `Card`, `Button`, and `Image` compose inside them.

Add private token theme packs when a starter needs a quick visual direction:

```bash
snz-bp add theme minimal
snz-bp add theme editorial
snz-bp add theme brutalist
```

Theme packs append a marked `snz-bp theme` block to `src/styles.css` and refuse to replace an existing theme block unless `--force` is passed.

Create `src/components/Feature.html`:

```html
<!--
  @desc Feature item with heading, body, and optional link.
  @attr title! Heading text.
  @attr href Optional CTA URL.
  @attr variant=[default|accent] :class Visual style.
-->
<article class="crd">
  <h2>{{title}}</h2>
  <div>{{slot}}</div>
  <a class="lnk" href="{{href}}">Learn more</a>
</article>

<style>
  .crd.accent {
    background: var(--a05);
  }
</style>
```

Use it in routes as `<Feature title="Fast">Body</Feature>`.

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
  <Card><h3>One</h3><p>...</p></Card>
  <Card><h3>Two</h3><p>...</p></Card>
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

Place master in `src/images/hero.png` or a PagesCMS `media.input` image root (default `src/images/hero.png`), then:

```html
<Image src="hero" alt="Product interface" max="1200" loading="eager" />
```

Build emits responsive WebP variants under `/assets/images/`. Lazy images include a temporary `.img-tmp` preview that site code removes after the main image loads. `loading="eager"` skips the preview for above-fold images. The main image has no private `.img-main` class; target `.img-w img` or `.img-tmp` when styling. Keep each logical basename unique across image roots.

### Add public media files

Use source roots by media class:

- `src/videos/` → `/assets/videos/` for public video files. Passthrough today; future compression/transcoding belongs here.
- `src/files/` → `/assets/files/` for public PDFs, audio, zips, and downloads.

Anything in `src/images/`, `src/videos/`, or `src/files/` is publishable. Build validates authored `/assets/images/*`, `/assets/videos/*`, and `/assets/files/*` refs exist; it does not publish only detected usage.

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

Then add markdown. Built-in collections need no config: `content/pages/about.md` → `/about/`; `content/posts/intro.md` → `/insights/intro/`.

```md
---
title: About
description: Why this exists.
---

Markdown body.
```

`content/posts/name.md` → `/insights/name/`. Drafts excluded from production builds.

Optional custom collections live in `content/collections.json`:

```json
{
  "collections": [
    {
      "name": "projects",
      "path": "content/projects",
      "template": "project.html",
      "route": "work/{slug}",
      "required": ["title"]
    }
  ]
}
```

`content/projects/acme.md` builds to `/work/acme/` through `src/templates/project.html`. `posts` and `pages` are reserved. Filename basename is the URL slug. Custom collections do not create indexes, feeds, or tag pages by default.

## CSS ownership

Global CSS files:

- `src/styles.css` — import shell and layer order.
- `src/styles/system.css` — editable token config, fluid engine, color/theme tokens.
- `src/styles/reset.css` — reset and base element rules.
- `src/styles/type.css` — heading/body type utilities, including `.fw-l`, `.fw-r`, `.fw-b`.
- `src/styles/grid.css` — `[g]`, `[c]`, `[r]`, `[o]`.
- `src/styles/wrappers.css` — `.c`, `.w`, `.crd`, `.btns`, `.lnks`, tiny global wrappers.
- `src/styles/motion.css` — scroll/view-transition hooks.
- Legacy support: `src/styles/styles.css` can still be migrated, but new work uses the split files.

Component CSS:

- Lives inside component file `<style>`.
- Bundled to `dist/assets/css/components.{hash}.css` inside `@layer snz.components`.
- Loads after global CSS and before route CSS.

Token legend: layout uses `--mw`, `--px`, `--py`, `--ss`, `--gp`, `--pd`, `--br`, `--bw`; type uses `--fw-l`, `--fw-r`, `--fw-b`, plus `--md-*`, `--lg-*`, `--sm-*`, `--h0-*`…`--h6-*`; weight utilities are `.fw-l`, `.fw-r`, `.fw-b`; color config uses `--l`, `--d`, `--a`, `--ai`, `--c`, `--ci`; semantic output uses `--s`, `--i`, `--t`, `--b`, `--g`. Use `data-theme="accent"`, `tone`, and `invert` for section themes. Class language is semantic-first and short: `.c`, `.w`, `.crd`, `.btn`, `.btns`, `.lnk`, `.lnks`, `.eb`; private hooks stay concise (`.brg`, `.logo-mk`, `.code-lb`).

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

Full contract: `framework/docs/components.md`.

## Route rules

- Route files are body markup.
- Optional top `<head>...</head>` wrapper supports SEO and transition meta.
- Inline `<script>` allowed only at top of route; build wraps it in `snz.onPage('{slug}', ...)`.
- Route `<style>` is allowed for one-off page CSS in authored static routes. Build extracts it to `dist/assets/css/routes/{slug}.{hash}.css` inside `@layer snz.pages.{slug}` and links it from that route head.
- Component-specific CSS still belongs in component `<style>`. Reusable/global primitives belong in `src/styles/*`.
- Authored/content/generated routes share one slug registry. Duplicate public slugs fail loudly; `src/pages` only replaces legacy `src/routes` for the same slug.

## App scripts

`src/app.ts` is the default site code entry and is bundled with `Bun.build`. Author code can use imports and TypeScript directly. Starter projects include `src/snz.d.ts` for typed `window.snz`, `snz:page`, and `snz:track` usage. `src/app.js` still works as an escape hatch, but do not keep both files; the build fails on ambiguous root app entries. Shell head scripts, component lifecycle scripts, and route top scripts are appended to the same hashed `dist/assets/js/app.{hash}.js` output. Only `PUBLIC_*` env vars are inlined.

## Vercel analytics intent

`src/site.json` may include `vercel.analytics` and `vercel.speedInsights`, but those flags are docs/check intent only. Do not add Analytics or Speed Insights scripts automatically from the renderer. Enable Vercel features per client project, then wire any required package/script explicitly.

Use component `track="Event name"` for simple marketing events. It compiles to `data-snz-track`; `snz.track(event, data?)` calls Vercel Analytics when `window.va` exists and otherwise emits `snz:track` for custom adapters.

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
bun run doctor -- --launch # pre-launch SEO/a11y/site gate
```

Use `--launch` before deploy/client handoff. It keeps normal check behavior intact, then adds stricter launch blockers/warnings: public `site.url`, OG image, titles/descriptions, H1s, missing image alt, vague or icon-only links, private URLs, and discovery artifacts. Warnings still need human review.

Build errors should include file, line, and hint. Fix source, not `dist/`.

## Before shipping answer

Minimum evidence for code/docs changes:

- Structural/component/build changes: `bun run build`.
- CSS ownership changes: `bun run doctor`.
- Docs-only change: no command required unless links/generated docs touched.

Report exact commands run and result.
