# AGENTS.md — SANITIZE Boilerplate

SANITIZE Boilerplate (`@snz/bp`) static site builder. Repo: `sanitizestudio/snz-bp`. Site work edits `src/` and optional `content/`. Framework work edits `framework/`. Build writes `dist/` (gitignored). Never edit `dist/`. Never put source in `.snz/`; `.snz/` is cache/state only. Loud errors with file/line/hint.

Need quick framework mental model? Read `framework/docs/agent-guide.md` first, then `framework/docs/components.md` for component work.

## Commands

```bash
bun run dev      # http://localhost:3000 with watch + SSE hot reload + in-page error banner
bun run build    # writes dist/, runs strict checks at the end
bun run check    # rebuild + validate without serving
bun run css:audit # report component-owned selectors left in global CSS
bun run doctor   # CSS ownership audit + strict check
bun run doctor -- --launch # launch-ready SEO/a11y/site gate
bun run new      # scaffolder: component|route|post|page <name>, collection <name>, or cms
```

Requires **Bun >= 1.3.14** (for `Bun.Image`). Use Bun only — no npm commands.

## Layout

| Path | What |
|---|---|
| `src/shell.html` | Page wrapper — header, main, footer, scripts (build → `dist/index.html`) |
| `src/pages/**/*.html` | Static routes; one file → one URL |
| `src/components/*.html` | One HTML file per component. Schema inline at top as `<!-- @desc / @attr -->` comment. |
| `src/site.json` | Site config: name, url, description, ogImage, locale, scroll |
| `src/styles.css`, `src/styles/*.css` | Global CSS import shell, tokens, reset, type, grid, wrappers, motion |
| `src/app.ts` (`src/app.js` escape hatch) | Site code entry |
| `src/images/` | Public raster masters and opt-in PagesCMS uploads → built to webp at multiple sizes |
| `src/videos/` | Public video files → copied to `/assets/videos/` (future video pipeline source) |
| `src/files/` | Public raw files (PDF, audio, downloads) → copied to `/assets/files/` |
| `src/routes/**/*.html` | Legacy static route input; `src/pages` wins on collisions |
| `src/styles/styles.css` | Legacy global CSS path |
| `src/app/app.js` | Legacy app entry + optional runtime helpers |
| `src/templates/post.html` | Opt-in CMS post render shell |
| `src/templates/*.html` | Custom collection render shells |
| `content/posts/*.md` | Opt-in PagesCMS posts → `/insights/{slug}/` |
| `framework/runtime/lib/paths.js` | Shared by router (browser) + build (Bun) |
| `framework/runtime/router.js` | Client framework, exposes `window.snz` |
| `framework/build/` | Build pipeline (TypeScript, runs in Bun) |
| `framework/dev.ts` | Dev server with watch + SSE hot reload + in-page error banner |
| `framework/docs/agent-guide.md` | Fast orientation for LLMs: mental model, tasks, CSS ownership, checks |
| `framework/docs/client-site-playbook.md` | End-to-end client-site build playbook for agents and humans |
| `framework/docs/agent-recipes.md` | Short task recipes for common framework work |
| `framework/docs/components.md` | Component authoring contract |
| `framework/docs/component-prompt.md` | Copy-paste prompt for LLM-spawned components |
| `framework/docs/components-catalog.md` | **Auto-generated** catalog — do not hand-edit |
| `framework/docs/decisions/` | Short ADRs |
| `framework/cli/snz-bp.ts` | Package CLI wrapper |
| `framework/tests/` | Framework test suite |
| `framework/scripts/` | Private maintenance scripts |
| `templates/default/` | Starter client site |
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

Read **`framework/docs/agent-guide.md`** for framework orientation and **`framework/docs/components.md`** for the full component contract. Highlights:

- One file per component: `src/components/PascalName.html`. No JSON sidecars.
- Leading `<!-- @desc ... @attr name! ... -->` comment declares the contract.
- `{{attr}}` for attributes, `{{slot}}` for default children, `{{slot:name}}` for named slots.
- Variants: `@attr variant=[a|b|c] :class` — value gets appended as a class on the template root. Use combo classes + nested CSS, no BEM.
- Optional `<script>` block runs once per instance; `el` bound to the root, return a function for cleanup.
- `<style>` colocated and auto-bundled into `dist/assets/css/components.{hash}.css`.

Built-in components: `Header`, `Footer`, `Logo`, `SEO`, `Image`, `Embed`, `Button`, `Link`, `Card`, `Accordion`, `FAQ`, `Section`, `Markdown`, `Stack` (deprecated; use `.w`), `Grid`, `Code`, `Badge`, `Icon`, `Socials`, `Social`, `Statement`, `Split`, `Counter`, `Tabs`, `Tab`, `TabPanel`, `Slider`, `Gallery`, `Marquee`, `Masonry`, `Form`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Fieldset`, `Submit`, `FormStatus`.

To spawn a new component via LLM, hand it `framework/docs/component-prompt.md`. Or just write the file yourself.

## Forms

Use form primitives for repeated contact/newsletter UI: `Form`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Fieldset`, `Submit`, `FormStatus`. Components stay flat in `src/components/` — no `src/components/form/` folder unless the framework gains recursive component loading. Forms are static-first: set an explicit `action`, use native validation attrs (`required`, `type`, `pattern`, `minlength`, etc.), and keep endpoints/provider secrets outside frontend code. `Button` is a link CTA; use `Submit` for real `<button type="submit">` controls.

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

## Media files

- `src/images/`, `src/videos/`, and `src/files/` are public source roots. Anything inside can be published; do not store private drafts there.
- Videos copy raw from `src/videos/` to `dist/assets/videos/`. Add compression/transcoding later in this folder's pipeline, not as a new source root.
- Files copy raw from `src/files/` to `dist/assets/files/` for PDFs, audio, zips, and downloads.
- Build validates authored `/assets/images/*`, `/assets/videos/*`, and `/assets/files/*` references exist.

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
- Token legend: `--mw`, `--px`, `--py`, `--ss`, `--gp`, `--pd`, `--br`, `--bw`; type uses `--fw-l`, `--fw-r`, `--fw-b`, plus `--md-*`, `--lg-*`, `--sm-*`, `--h0-*`…`--h6-*`; color uses `--l`, `--d`, `--a`, `--ai`, `--c`, `--ci`, then semantic `--s`, `--i`, `--t`, `--b`, `--g`.
- Global layout primitives: `.c`, `.w`, `.crd`, `.btns`, `.lnks`, `[g]`, `[c]`, `[r]`, `[o]`.
- `[g]` is grid container; `[c]` column span; `[r]` row span; `[o]` visual order. Use split values (`g="4-2"`, `c="6-3"`, `o="f-a"`). Small stacks by default.
- Component `<style>` bundled into `dist/assets/css/components.{hash}.css` (content-hashed; cache forever).
- Component CSS loads **after** base so component rules win at equal specificity.
- Class language is semantic-first and short. Use classes only for durable primitives (`.c`, `.w`, `.crd`, `.btn`, `.btns`, `.lnk`, `.lnks`), type/tone utilities (`.eb`, `.f-*`, `.fw-*`, `.c-*`, `.h*`), or concise private hooks (`.brg`, `.logo-mk`, `.code-lb`).
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

1. Read `framework/docs/components.md`.
2. Or copy `framework/docs/component-prompt.md` and hand it to Claude.
3. `bun run new component MyThing` (or drop `src/components/MyThing.html` by hand).
4. `bun run build`. Build refuses if the contract is violated.

## Out of scope

- No editing `dist/` (it's generated; gitignored).
- No runtime JS framework. No virtual DOM. No hydration.
- No npm dependencies — Bun stdlib only.

## Decisions

`framework/docs/agent-guide.md` — canonical quickstart for LLM agents.

`framework/docs/decisions/` — short notes on architectural choices worth knowing.
