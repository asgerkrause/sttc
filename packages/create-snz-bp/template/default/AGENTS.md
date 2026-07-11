# AGENTS.md — SANITIZE Boilerplate

SANITIZE Boilerplate (`@snz/bp`) client site. Edit `src/` and optional `content/`. Build writes `dist/` (gitignored). Never edit `dist/`. Never put source in `.snz/`; `.snz/` is cache/state only. Loud errors with file/line/hint.

Framework internals live in package `@snz/bp`, not this client repo.

## Commands

```bash
bun run dev      # http://localhost:3000 with watch + SSE hot reload + in-page error banner
bun run build    # writes dist/, runs strict checks at the end
bun run check    # rebuild + validate without serving
bun run css:audit # report component-owned selectors left in global CSS
bun run doctor   # CSS ownership audit + strict check
bun run new      # scaffolder: component|route|post|collection <name>, or cms
bun run skills sync # update managed .agents/skills from installed @snz/bp
```

Requires **Bun >= 1.3.14** (for `Bun.Image`).

## Agent skills

OpenCode and Cursor discover framework workflows in `.agents/skills/`:

- `snz-component` — choose composition, preset, or custom component.
- `snz-collection` — choose authored page, posts, or custom records.
- `snz-launch` — produce launch-readiness evidence.
- `snz-diagnose` — reproduce and isolate framework failures.

Run `bun run skills sync --check` to detect drift. Run `bun run skills sync` to install missing or updated managed skills. Locally modified or unmarked collisions are reported and never overwritten.

## Layout

| Path | What |
|---|---|
| `src/shell.html` | Page wrapper — header, main, footer, scripts (build → `dist/index.html`) |
| `src/pages/**/*.html` | Static routes; one file → one URL |
| `src/components/*.html` | One HTML file per component. Schema inline at top as `<!-- @desc / @attr -->` comment. |
| `src/site.json` | Site config: name, url, description, ogImage, locale, scroll |
| `src/styles.css`, `src/styles/*.css` | Global CSS import shell, tokens, reset, type, grid, wrappers, motion |
| `src/app.ts` (`src/app.js` escape hatch) | Site code entry |
| `src/images/` | Raster masters and opt-in PagesCMS uploads → built to webp at multiple sizes |
| `src/routes/**/*.html` | Legacy static route input; `src/pages` wins on collisions |
| `src/styles/styles.css` | Legacy global CSS path |
| `src/app/app.js` | Legacy app entry + optional runtime helpers |
| `src/templates/post.html` | Opt-in CMS post render shell |
| `src/templates/*.html` | Custom collection render shells |
| `content/posts/*.md` | Opt-in PagesCMS posts → `/insights/{slug}/` |
| `.snz/` | Local cache/state only; never source code |
| `site.code-workspace` | Authoring-focused Cursor/VS Code workspace |
| `.pages.yml` | Opt-in PagesCMS config |

## Shell vs route

- Shell loads once. Router fetches `/routes/{slug}.html` and injects into `<main data-route-root>`.
- Route files are body markup. Optional `<head>...</head>` wrapper for per-route SEO + transition variant.

```html
<head>
  <SEO title="About" description="..." />
  <meta name="snz:transition" content="fade">
</head>

<Section>
  <h1>About</h1>
  <p>...</p>
</Section>
```

## Components

For framework orientation, see package docs in `node_modules/@snz/bp/framework/docs/` after install. Highlights:

- One file per component: `src/components/PascalName.html`. No JSON sidecars.
- Leading `<!-- @desc ... @attr name! ... -->` comment declares the contract.
- `{{attr}}` for attributes, `{{slot}}` for default children, `{{slot:name}}` for named slots.
- Variants: `@attr variant=[a|b|c] :class` — value gets appended as a class on the template root. Use combo classes + nested CSS, no BEM.
- Optional `<script>` block runs once per instance; `el` bound to the root, return a function for cleanup.
- `<style>` colocated and auto-bundled into `dist/assets/css/components.{hash}.css`.

Built-in components: `Header`, `Footer`, `Logo`, `SEO`, `Image`, `Embed`, `Button`, `Link`, `Card`, `Product`, `Products`, `Accordion`, `FAQ`, `Section`, `Markdown`, `Stack` (deprecated; use `.stack`), `Grid`, `Code`, `Badge`, `Icon`, `Socials`, `Social`, `Statement`, `Split`, `Counter`, `Tabs`, `Tab`, `TabPanel`, `Slider`, `Gallery`, `Marquee`, `Masonry`, `Form`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Fieldset`, `Submit`, `FormStatus`.

To spawn a new component via LLM, use the component contract in `node_modules/@snz/bp/framework/docs/components.md`. Or just write it yourself.

## Forms

Use form primitives for repeated contact/newsletter UI: `Form`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Fieldset`, `Submit`, `FormStatus`. Components stay flat in `src/components/` — no `src/components/form/` folder unless framework docs say recursive component loading exists. Forms are static-first: set an explicit `action`, use native validation attrs (`required`, `type`, `pattern`, `minlength`, etc.), and keep endpoints/provider secrets outside frontend code. `Button` is a link CTA; use `Submit` for real `<button type="submit">` controls.

## Routes

Drop `src/pages/{slug}.html`. Home is `index.html` (→ `/`). Nested pages map by path: `blog/index.html` → `/blog/`, `work/case.html` → `/work/case/`. 404 is `404.html`. Legacy `src/routes/` still works.

Inline `<script>` allowed only at the top of a route — auto-extracted and wrapped with `snz.onPage('{slug}', ...)` at build time. Route `<style>` is allowed for one-off page CSS; build extracts it to route-owned CSS under `@layer snz.pages.{slug}`.

## Content pipeline

CMS is opt-in and content-record focused. Run `bun run new cms` to create `.pages.yml`, `content/posts/`, `src/images/`, and `src/templates/post.html`. Authored pages stay in `src/pages/`; custom records use `bun run new collection`.

```yaml
---
title: Hello, world
date: 2026-05-26
description: First post.
tags: [tutorial, intro]
draft: false
---

Body in **markdown**. Supports headings, lists, links, code, emphasis, blockquotes.
```

Drafts (`draft: true`) are excluded from production builds, included in dev. Tags emit `/tags/{tag}/` indexes automatically. Generated `/insights/`, `/tags/`, and `/tags/{tag}/` routes fail loudly if authored/content routes already own those slugs.

## Images

- Masters and PagesCMS uploads live in `src/images/`.
- Build encodes to `dist/assets/images/{name}.webp` via `Bun.Image`, with responsive variants (320, 640, 1024, {max}).
- `<Image src="hero" alt="..." max="1200" quality="82" />` — `max`/`quality` are pre-scanned to choose the largest needed size.
- Lazy by default. Lazy images render a temporary `.img-tmp` preview over the main image; `loading="eager"` skips that preview for above-fold images. Main image has no private `.img-main` class.
- OG: `src/images/og.png` → `dist/assets/og.webp` (+ `og.png` fallback).

## Client framework (`router.js`)

Exposes a stable API at `window.snz`:

```js
snz.navigate('/about/')                 // programmatic nav
snz.page()                              // current slug
snz.onPage('about', fn)                 // run when on /about/; fires immediately if already there
snz.onPage('*', fn)                     // every navigation
snz.prefetch('/contact/')               // warm route cache
snz.beforeNavigate(fn)                  // return false to cancel
snz.afterNavigate(fn)                   // post-DOM-swap, post-scroll
```

Disclosure widget: any `<button aria-controls aria-expanded>` toggles on click. Escape closes. `data-snz-ignore` opts out. `nav[id]` + `button[aria-controls="{id}"]` is the standard pair.

Route preload: same-origin `<a>` warms the route cache after ~100ms hover/focus. `data-snz-preload="off"` opts out.

Route cache TTL: 5 minutes; invalidates after 10 min in background.

Per-route transition variants: `<meta name="snz:transition" content="fade|slide|none">` in the route's `<head>` sets `html[data-transition="..."]` during navigation.

## Scroll

Lenis is **optional and self-hosted** (`src/app/vendor/lenis.min.js`, pinned 1.1.20).

```jsonc
// src/site.json
{ "scroll": "lenis" }   // default — loads Lenis (unless prefers-reduced-motion)
{ "scroll": "native" }  // skips Lenis entirely
```

Router's scroll-reset prefers `window.lenis?.scrollTo(0, { immediate: true })` when present; falls back to `window.scrollTo(0,0)`.

## AI-native discovery layer

Every build emits (invisible to authoring — these are build outputs):

| Artifact | Purpose |
|---|---|
| `/sitemap.xml`, `/robots.txt` | Classic sitemap + robots |
| `/feed.xml`, `/feed.json` | RSS + JSON Feed for posts |
| `/llms.txt`, `/llms-full.txt` | llmstxt.org-style site index |
| `/.well-known/ai-plugin.json` | Plugin discovery → points at manifest |
| `/site.manifest.json` | Full index: site config, routes, components, schemas |
| `/routes/{slug}.json` | Per-route data + extra JSON-LD |
| `<script type="application/ld+json">` | In every HTML route head |

Structured data auto-emitted:
- `<Accordion>` / `<FAQ>` → `FAQPage`
- `content/posts/*` → `BlogPosting`
- Any component with `@schema TypeName field=attr,...` in its inline comment

## CSS

- Base tokens + reset: `src/styles.css` imports split CSS under `src/styles/`.
- Token legend: layout `--l-*`, space `--s-*`, type `--t-*`, color `--c-*`, motion `--m-*`, interaction `--i-*`, element roles `--e-*`. Key tokens: `--l-mw`, `--l-gc`, `--s-px`, `--s-py`, `--s-gp`, `--s-pd`, `--s-br`, `--s-bw`; type `--t-fw-l/r/b`, `.fw-l/.fw-r/.fw-b`, `.t-md/.t-lg/.t-sm`, `--t-md-*`, `--t-lg-*`, `--t-sm-*`, `--t-h0-*`…`--t-h6-*`; color `--c-bg`, `--c-fg`, `--c-ink`, `--c-sur`, `--c-mut`, `--c-bor`, `--c-acc`, `--c-sec`, `--c-acc-sur/ink/bor`, `--c-sec-sur/ink/bor`. Use grouped tokens only; no short aliases.
- Global role primitives: `.container`, `.stack`, `.card`, `.button`, `.buttons`, `.link`, `.links`, `.media`, `.eyebrow`.
- Responsive attrs: layout `[g]`, `[c]`, `[r]`, `[o]`; type/rhythm `[t]`, `[gp]`; spacing `[mg]`, `[mg-t/r/b/l/tb/lr]`, `[pd]`, `[pd-t/r/b/l/tb/lr]`.
- Values read large → medium → small. One value applies everywhere; two set large/small; three set large/medium/small. Type accepts `h0`–`h6`, `lg`, `md`, `sm`; spacing accepts `xl`, `lg`, `md`, `sm`, `xs`, `0`. Grid keeps its documented numeric/auto values. Small screens stack by default.
- Component `<style>` bundled into `dist/assets/css/components.{hash}.css` (content-hashed; cache forever).
- Component CSS loads **after** base so component rules win at equal specificity.
- Classes name objects; compact attrs own token-bound responsive composition; nested CSS owns local art direction. Keep `.t-*` only as migration aliases. Private hooks stay concise (`.brg`, `.logo-mk`, `.code-lb`).
- Component-specific selectors belong in component files. Run `bun run css:audit` or `bun run doctor` when cleaning CSS boundaries.
- Per-page route CSS: use `<style>` in authored routes for one-off page rules; build extracts to `@layer snz.pages.{slug}`. Use `html[data-page="{slug}"]` in global CSS only for durable cross-route overrides.

## JS bundling

- `src/app.ts` is your site code. `src/app.js` works as an escape hatch; do not keep both. Legacy `src/app/app.js` still works when no root app entry exists.
- Build bundles `src/app.ts` (or the `src/app.js` escape hatch) with `Bun.build`, then appends shell head inline scripts, component lifecycle scripts, and route top scripts (wrapped with `snz.onPage('{slug}', ...)`) into `dist/assets/js/app.{hash}.js`.
- Starter projects include `src/snz.d.ts` for typed `window.snz` and `snz:page` events. Runtime `router.js` stays framework-owned JS intentionally.

## Errors

Build throws `BuildError` with file/line/hint for any violation:

- Missing required component attribute
- Unknown component (PascalCase typo)
- Unknown attribute on a strict schema
- `<style>` in a route
- Broken internal link
- Missing discovery artifact
- A leftover `*.schema.json` sidecar in `src/components/` (legacy — migrate to inline comment)

Dev server writes `dist/__build-error.html` and serves it instead of routes until the next successful build. Save a file to retry.

## Adding a page

1. `bun run new route pricing` (or drop `src/pages/pricing.html` by hand).
2. Use components.
3. `bun run build`. Page is at `/pricing/`, in manifest, sitemap, llms.txt, `/routes/pricing.json`.

## Adding a component

1. Read `node_modules/@snz/bp/framework/docs/components.md` after install.
2. Or write the component file yourself.
3. `bun run new component MyThing` (or drop `src/components/MyThing.html` by hand).
4. `bun run build`. Build refuses if the contract is violated.

## Out of scope

- No editing `dist/` (it's generated; gitignored).
- No runtime JS framework. No virtual DOM. No hydration.
- No npm dependencies — Bun stdlib only.

## Decisions

Package docs live under `node_modules/@snz/bp/framework/docs/` after install.
