# SANITIZE Boilerplate

`@snz/bp` — HTML-first, Bun-native static site builder. Author HTML; ship a site with structured data, llms.txt, and a machine-readable manifest. Zero npm dependencies.

Repo: `sanitizestudio/snz-bp`.

## Stack

- **Runtime**: Bun (>= 1.3.14, for `Bun.Image`).
- **Output**: a static `dist/` you can host anywhere.
- Markdown, image processing, hashing, server — all Bun stdlib.

## Commands

```bash
bun run dev       # http://localhost:3000, watch + SSE hot reload + in-page error banner
bun run build     # produce dist/, run strict checks at the end
bun run check     # rebuild + validate without serving
bun run doctor    # CSS ownership audit + strict check
bun run new       # scaffolder: component|route|post|page <name>, or cms
```

Package CLI:

```bash
snz-bp dev
snz-bp build
snz-bp check
snz-bp doctor
snz-bp new component Hero
snz-bp new cms
snz-bp migrate
```

`bun run build --allow-broken-links` skips the link checker.

## Starter template

New client project starter lives in `templates/default/`. Creator package lives in `packages/create-snz-bp/`.

Private local UX:

```bash
bun scripts/install-local-creator.ts
create-snz-bp my-client
cd my-client
bun install
bun dev
```

Create in current empty directory:

```bash
create-snz-bp .
bun install
bun dev
```

Target published UX later:

```bash
bun create snz-bp my-client
cd my-client
bun install
bun dev
```

Current local verification:

```bash
cd templates/default
bun ../../bin/snz-bp.ts check
```

Private local creator rewrites `@snz/bp` to `file:<this repo>`, so `bun install` must run before `bun dev`. Later, published clients should depend on `@snz/bp` and run `bun update @snz/bp` for framework upgrades.

## Workspace modes

- Framework mode: open the repo root to edit `build/`, `runtime/`, `packages/`, docs, and the starter.
- Author mode: open `site.code-workspace` in Cursor/VS Code to focus on `src/`, content, media, and site docs while hiding framework internals.

Generated starter projects also include `site.code-workspace` for authoring-only work.

## Layout

```
src/
  shell.html              Page wrapper (header + main + footer + scripts)
  site.json               Brand defaults: name, url, description, ogImage, scroll
  pages/                  Static pages; nested files map to nested URLs
  components/             One HTML file per component — that's it
  styles.css              Tokens, reset/base, layout primitives, page overrides
  app.js or app.ts        Site code
  images/                 Image masters → built to webp at multiple sizes

Opt-in/legacy:
  src/routes/             Legacy route input; src/pages wins on collisions
  src/styles/styles.css   Legacy global CSS path
  src/app/app.js          Legacy app entry
  src/templates/          CMS render shells
  content/                PagesCMS markdown
  media/images/           PagesCMS uploads, also fed through image pipeline

runtime/
  router.js               Client framework, exposes window.snz
  lib/paths.js            Shared by router + build
build/                    Build pipeline (TypeScript, runs in Bun)
dev.ts                    Dev server with file watcher
docs/
  agent-guide.md          Fast orientation for LLM agents
  components.md           Component authoring contract
  component-prompt.md     Copy-paste prompt for spawning components via LLM
  components-catalog.md   Auto-generated catalog (do not hand-edit)
  decisions/              Short ADRs
```

## Components

Invoked as `<PascalName />` or `<PascalName>children</PascalName>`. **One file per component.** Schema lives in a leading `<!-- @desc / @attr -->` comment at the top of each `.html`. Agent orientation is in [`docs/agent-guide.md`](./docs/agent-guide.md). Authoring contract is in [`docs/components.md`](./docs/components.md).

Built-ins (15):
`Header`, `Footer`, `SEO`, `Image`, `Button`, `Link`, `Card`, `Accordion`, `FAQ`, `Section`, `Markdown`, `Stack` (deprecated; use `.w`), `Grid`, `Code`.

Add a new component by handing [`docs/component-prompt.md`](./docs/component-prompt.md) to Claude, or just write it yourself.

CSS ownership: global CSS owns tokens, reset/base, `.c`, `.w`, and grid attrs `[g]`, `[c]`, `[r]`, `[o]`. Component-specific selectors live in component `<style>` blocks.

## Routes

Drop a file into `src/pages/`. It becomes its nested URL: `index.html` → `/`, `about.html` → `/about/`, `blog/index.html` → `/blog/`, `work/case.html` → `/work/case/`. Legacy `src/routes/` still works; `src/pages/` wins on slug collisions.

Override SEO per route with a `<head>` wrapper:

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

## Content pipeline

CMS support is opt-in. Run `bun run new cms` to create `.pages.yml`, `content/`, `media/images/`, and `src/templates/`. When `content/posts/*.md` or `content/pages/*.md` exist, they compile through `src/templates/{post,page}.html`. Minimal markdown subset.

```yaml
---
title: Hello, world
date: 2026-05-26
description: First post.
tags: [tutorial, intro]
draft: false
---

Body in **markdown**.
```

Drafts (`draft: true`) are excluded from production builds, included in dev. Tags emit `/tags/{tag}/` indexes automatically. Generated `/insights/`, `/tags/`, and `/tags/{tag}/` routes fail loudly if authored/content routes already own those slugs.

## AI-native discovery

Every build emits a full discovery layer (invisible to authoring — these are build outputs):

- `/llms.txt`, `/llms-full.txt` — site index for LLM crawlers (llmstxt.org).
- `/.well-known/ai-plugin.json` — plugin discovery pointing at the manifest.
- `/site.manifest.json` — machine-readable index of every route, every component instance, every schema, every internal link.
- `/routes/{slug}.json` — per-route data (title, description, components, schemas, extra JSON-LD).
- `/sitemap.xml`, `/robots.txt`, `/feed.xml`, `/feed.json`.

Structured data auto-emitted from components: `<Accordion>` / `<FAQ>` → `FAQPage`, posts → `BlogPosting`. Add `@schema TypeName field=attr,...` to any component to hook in your own JSON-LD type.

## Client framework

```js
window.snz = {
  navigate(path),                // programmatic nav
  page(),                        // current slug
  onPage('about', fn),           // run per-route, fires immediately if already there
  onPage('*', fn),               // every nav
  prefetch(path),                // warm route cache
  beforeNavigate(fn),            // return false to cancel
  afterNavigate(fn),             // post-swap, post-scroll
}
```

Route scripts at the top of a route file are auto-wrapped with `snz.onPage('{slug}', ...)` at build time.

Component `<script>` blocks become per-instance mount functions (see [`docs/components.md`](./docs/components.md) → Lifecycle scripts).

`src/app.js` or `src/app.ts` is bundled with `Bun.build`, so author code can use imports and TypeScript. Only `PUBLIC_*` env vars are inlined.

## Scroll

Lenis is optional and self-hosted (`src/app/vendor/lenis.min.js`). Toggle in `site.json`:

```jsonc
{ "scroll": "lenis" }   // default
{ "scroll": "native" }  // skip Lenis entirely
```

`prefers-reduced-motion: reduce` always disables it.

## Asset caching

`app.js` and `components.css` are content-hashed (`app.{hash}.js`, `components.{hash}.css`). Cache them forever — they invalidate when their contents change.

## Adding a page

1. Drop `src/pages/pricing.html` (or `bun run new route pricing`). Use nested files for nested URLs.
2. Optional `<head><SEO title="..." description="..." /></head>` wrapper.
3. Use components: `<Card title="..."><Button href="..." label="..." />...</Card>`.
4. `bun run build`. Page is at `/pricing/`, in manifest, sitemap, llms.txt, and `/routes/pricing.json`.

## Adding a component

1. Read [`docs/components.md`](./docs/components.md).
2. Or copy [`docs/component-prompt.md`](./docs/component-prompt.md) and hand it to Claude.
3. Drop `src/components/MyThing.html`.
4. `bun run build`. Build refuses if the contract is violated.

## See also

- [`AGENTS.md`](./AGENTS.md) — orchestration guide for agents working in this repo.
- [`docs/agent-guide.md`](./docs/agent-guide.md) — quick framework mental model for LLMs.
- [`docs/decisions/`](./docs/decisions/) — architectural decisions worth knowing.
- [`future-desires/todo.md`](./future-desires/todo.md) — parked ideas.
