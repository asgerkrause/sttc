# AGENTS.md — SANITIZE Boilerplate

SANITIZE Boilerplate (`@snz/bp`) static site builder. Repo: `sanitizestudio/snz-bp`. Edit `src/`. Build writes `dist/` (gitignored). Never edit `dist/`. Loud errors with file/line/hint.

Need quick framework mental model? Read `docs/agent-guide.md` first, then `docs/components.md` for component work.

## Commands

```bash
bun run dev      # http://localhost:3000 with watch + SSE hot reload + in-page error banner
bun run build    # writes dist/, runs strict checks at the end
bun run check    # rebuild + validate without serving
bun run css:audit # report component-owned selectors left in global CSS
bun run doctor   # CSS ownership audit + strict check
bun run new      # scaffolder: component|route|post|page <name>, or cms
```

Requires **Bun >= 1.3.14** (for `Bun.Image`).

## Layout

| Path | What |
|---|---|
| `src/shell.html` | Page wrapper — header, main, footer, scripts (build → `dist/index.html`) |
| `src/pages/**/*.html` | Static routes; one file → one URL |
| `src/components/*.html` | One HTML file per component. Schema inline at top as `<!-- @desc / @attr -->` comment. |
| `src/site.json` | Site config: name, url, description, ogImage, locale, scroll |
| `src/styles.css` | Global tokens, reset, layout primitives, page overrides |
| `src/app.js` / `src/app.ts` | Site code entry |
| `src/images/` | Raster masters → built to webp at multiple sizes |
| `src/routes/**/*.html` | Legacy static route input; `src/pages` wins on collisions |
| `src/styles/styles.css` | Legacy global CSS path |
| `src/app/app.js` | Legacy app entry + optional runtime helpers |
| `src/templates/{post,page}.html` | Opt-in CMS render shells |
| `content/posts/*.md` | Opt-in PagesCMS posts → `/insights/{slug}/` |
| `content/pages/*.md` | Opt-in PagesCMS pages → `/{slug}/` |
| `media/images/` | Opt-in PagesCMS image uploads |
| `runtime/lib/paths.js` | Shared by router (browser) + build (Bun) |
| `runtime/router.js` | Client framework, exposes `window.snz` |
| `build/` | Build pipeline (TypeScript, runs in Bun) |
| `dev.ts` | Dev server with watch + SSE hot reload + in-page error banner |
| `docs/agent-guide.md` | Fast orientation for LLMs: mental model, tasks, CSS ownership, checks |
| `docs/components.md` | Component authoring contract |
| `docs/component-prompt.md` | Copy-paste prompt for LLM-spawned components |
| `docs/components-catalog.md` | **Auto-generated** catalog — do not hand-edit |
| `docs/decisions/` | Short ADRs |
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

Read **`docs/agent-guide.md`** for framework orientation and **`docs/components.md`** for the full component contract. Highlights:

- One file per component: `src/components/PascalName.html`. No JSON sidecars.
- Leading `<!-- @desc ... @attr name! ... -->` comment declares the contract.
- `{{attr}}` for attributes, `{{slot}}` for default children, `{{slot:name}}` for named slots.
- Variants: `@attr variant=[a|b|c] :class` — value gets appended as a class on the template root. Use combo classes + nested CSS, no BEM.
- Optional `<script>` block runs once per instance; `el` bound to the root, return a function for cleanup.
- `<style>` colocated and auto-bundled into `dist/assets/css/components.{hash}.css`.

Built-in components (14): `Header`, `Footer`, `SEO`, `Image`, `Button`, `Link`, `Card`, `Accordion`, `FAQ`, `Section`, `Markdown`, `Stack` (deprecated; use `.w`), `Grid`, `Code`.

To spawn a new component via LLM, hand it `docs/component-prompt.md`. Or just write the file yourself.

## Routes

Drop `src/pages/{slug}.html`. Home is `index.html` (→ `/`). Nested pages map by path: `blog/index.html` → `/blog/`, `work/case.html` → `/work/case/`. 404 is `404.html`. Legacy `src/routes/` still works.

Inline `<script>` allowed only at the top of a route — auto-extracted and wrapped with `snz.onPage('{slug}', ...)` at build time. `<style>` not allowed in routes (use a component `<style>` or `html[data-page="{slug}"]` rules in `styles.css`).

## Content pipeline

CMS is opt-in. Run `bun run new cms` to create `.pages.yml`, `content/`, `media/images/`, and `src/templates/`. When `content/posts/*.md` or `content/pages/*.md` exist, they compile through `src/templates/{post,page}.html`. Front-matter must include `title`.

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

- Masters live in `src/images/` or `media/images/` (PagesCMS).
- Build encodes to `dist/assets/images/{name}.webp` via `Bun.Image`, with responsive variants (320, 640, 1024, {max}).
- `<Image src="hero" alt="..." max="1200" quality="82" />` — `max`/`quality` are pre-scanned to choose the largest needed size.
- Lazy by default. `loading="eager"` skips the placeholder for above-fold images.
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

Lenis is **optional and self-hosted** (`src/app.jsvendor/lenis.min.js`, pinned 1.1.20).

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

- Base tokens + reset: `src/styles.css` (`--mw`, `--bx`, `--by`, `--ffs`, `--fs`, color system).
- Global layout primitives: `.c`, `.w`, `[g]`, `[c]`, `[r]`, `[o]`.
- `[g]` is grid container; `[c]` column span; `[r]` row span; `[o]` visual order. Use split values (`g="4-2"`, `c="6-3"`, `o="f-a"`). Small stacks by default.
- Component `<style>` bundled into `dist/assets/css/components.{hash}.css` (content-hashed; cache forever).
- Component CSS loads **after** base so component rules win at equal specificity.
- Component-specific selectors belong in component files. Run `bun run css:audit` or `bun run doctor` when cleaning CSS boundaries.
- Per-page overrides: `html[data-page="{slug}"]` selectors in `styles.css`.

## JS bundling

- `src/app.js` or `src/app.ts` is your site code. Legacy `src/app/app.js` still works.
- Build bundles `src/app.js` / `src/app.ts` with `Bun.build`, then appends shell head inline scripts, component lifecycle scripts, and route top scripts (wrapped with `snz.onPage('{slug}', ...)`) into `dist/assets/js/app.{hash}.js`.

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

1. Read `docs/components.md`.
2. Or copy `docs/component-prompt.md` and hand it to Claude.
3. `bun run new component MyThing` (or drop `src/components/MyThing.html` by hand).
4. `bun run build`. Build refuses if the contract is violated.

## Out of scope

- No editing `dist/` (it's generated; gitignored).
- No runtime JS framework. No virtual DOM. No hydration.
- No npm dependencies — Bun stdlib only.

## Decisions

`docs/agent-guide.md` — canonical quickstart for LLM agents.

`docs/decisions/` — short notes on architectural choices worth knowing.
