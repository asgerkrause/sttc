# SANITIZE Boilerplate

`@snz/bp` — HTML-first, Bun-native static site framework. Author normal HTML in `src/`; the Bun build turns it into a static `dist/` site with components, routed pages, optimized images, structured data, llms.txt, feeds, and a machine-readable manifest.

It is not a React/Vue/Svelte/Vite wrapper. There is no runtime app framework, virtual DOM, or hydration layer. The tiny client framework is `framework/runtime/router.js`, exposed as `window.snz` for navigation hooks and page swaps.

Repo: `sanitizestudio/snz-bp`.

Private review status: packages are intentionally unpublished and marked `"private": true`. Do not publish, change npm access, or remove that guard until a human explicitly approves release.

## Stack

- **Runtime**: Bun (>= 1.3.14, for `Bun.Image`).
- **Output**: a static `dist/` you can host anywhere.
- **Author surface**: `src/`, optional `content/`, and `src/site.json`.
- **Framework surface**: `framework/`, `packages/`, and `templates/default/`.
- **Local state**: `.snz/` is cache/state only; never source code.
- Markdown, image processing, hashing, server — all Bun stdlib.

## Commands

```bash
bun run dev       # http://localhost:3000, watch + SSE hot reload + in-page error banner
bun run build     # produce dist/, run strict checks at the end
bun run check     # rebuild + validate without serving
bun run doctor    # CSS ownership audit + strict check
bun run doctor -- --launch # pre-launch SEO/a11y/site gate
bun run framework:verify # full framework gate: doctor, tests, template sync, create smoke
bun run new       # scaffolder: component|route|post|page <name>, collection <name>, or cms
bun run add       # add component preset or theme pack
```

Package CLI:

```bash
snz-bp dev                         # dev server + hot reload
snz-bp build                       # build dist/ + strict checks
snz-bp check                       # rebuild + validate
snz-bp doctor                      # CSS audit + check
snz-bp doctor --launch             # launch-ready SEO/a11y/site gate
snz-bp new route pricing           # scaffold src/pages/pricing.html
snz-bp new component Hero          # scaffold src/components/Hero.html
snz-bp new post hello-world        # scaffold content/posts/hello-world.md
snz-bp new route about             # scaffold authored page route
snz-bp new collection projects --route work/{slug} --template project
snz-bp new cms                     # create posts-only PagesCMS/content surface
snz-bp add component hero          # add private component preset
snz-bp add component lottie        # add optional Lottie component + local player
snz-bp add component hero --demo   # also add demo invocation when styles page exists
snz-bp add theme minimal           # append starter theme token block
snz-bp migrate                     # migrate legacy component sidecars
```

`bun run build --allow-broken-links` skips the link checker.

## Built-in boilerplate

`templates/default/` is the starter site copied into new client projects. It includes the authoring surface (`src/`, starter pages/components/styles/images, `src/site.json`, optional content folders, and `site.code-workspace`) without copying framework internals into every client repo.

Client projects run framework commands through `@snz/bp`. The starter stays editable; framework behavior can update from the package boundary later.

## Starter template

New client project starter lives in `templates/default/`. Creator package lives in `packages/create-snz-bp/`.

Private local UX:

```bash
bun framework/scripts/install-local-creator.ts
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

Target published UX later, after human release approval and private guards are removed:

```bash
bun create snz-bp my-client
cd my-client
bun install
bun dev
```

Current local verification:

```bash
bun run framework:verify
```

That runs `doctor`, the full framework test suite, template sync check, and create-smoke. For a narrower manual template check:

```bash
bun run check:create-template
cd templates/default
bun ../../framework/cli/snz-bp.ts check
cd ../..
bun run smoke:create
```

Private local creator rewrites `@snz/bp` to `file:<this repo>`, so `bun install` must run before `bun dev`. Packaged creator uses `packages/create-snz-bp/template/default` and writes the matching published `@snz/bp` semver range for smoke testing. Run `bun run prepare:create-template` before packaging. Publish steps and private guard removal live in [`framework/docs/publish-checklist.md`](./framework/docs/publish-checklist.md).

## Workspace modes

- Framework mode: open the repo root to edit `framework/`, `packages/`, docs, and the starter.
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
  app.ts                  Site code (TypeScript-first; app.js escape hatch)
  images/                 Image masters → built to webp at multiple sizes

Opt-in/legacy:
  src/routes/             Legacy route input; src/pages wins on collisions
  src/styles/styles.css   Legacy global CSS path
  src/app/app.js          Legacy app entry
  src/templates/          CMS render shells
  content/                PagesCMS markdown
  src/images/           Default PagesCMS media.input; optimized to /assets/images/

framework/
  cli/snz-bp.ts           Package CLI wrapper
  runtime/router.js       Client framework, exposes window.snz
  runtime/lib/paths.js    Shared by router + build
  build/                  Build pipeline (TypeScript, runs in Bun)
  dev.ts                  Dev server with file watcher
  tests/                  Framework tests
  scripts/                Private maintenance scripts
  docs/                   Framework docs, recipes, component contract, decisions
.snz/                     Local cache/state only; never source code
```

## Components

Invoked as `<PascalName />` or `<PascalName>children</PascalName>`. **One file per component.** Schema lives in a leading `<!-- @desc / @attr -->` comment at the top of each `.html`. Agent orientation is in [`framework/docs/agent-guide.md`](./framework/docs/agent-guide.md), client build flow in [`framework/docs/client-site-playbook.md`](./framework/docs/client-site-playbook.md), task recipes in [`framework/docs/agent-recipes.md`](./framework/docs/agent-recipes.md), and authoring contract in [`framework/docs/components.md`](./framework/docs/components.md).

Built-ins are generated from `src/components/*.html`; current contracts live in [`framework/docs/components-catalog.md`](./framework/docs/components-catalog.md). Common primitives include `Section`, `Grid`, `Card`, `Button`, `Link`, `Image`, `Markdown`, `Accordion`, `FAQ`, and `SEO`.

Add a new component by handing [`framework/docs/component-prompt.md`](./framework/docs/component-prompt.md) to Claude, or just write it yourself.

Add private slot-first presets with `snz-bp add component <preset>`. Presets include `hero`, `cta`, `features`, `partners`, `pricing`, `testimonials`, `stats`, `process`, `faq`, and optional `lottie`. They use content nouns: plural wrappers (`Features`, `Testimonials`, `Partners`) and singular items (`Feature`, `Testimonial`, `Partner`). `lottie` adds `Lottie.html` plus a local `src/app/vendor/lottie.min.js` player only when chosen. Generated files compose existing `Grid`, `Card`, `Button`, and `Image`; edit them locally after scaffolding. Pass `--demo` to append component invocation to `src/pages/styles.html` or legacy `src/routes/styles.html` when present.

Theme token packs are private starter shortcuts, not design systems:

```bash
snz-bp add theme minimal      # neutral, clean default
snz-bp add theme editorial    # type-forward, content-heavy
snz-bp add theme brutalist    # bold/high-contrast
```

Theme packs append a marked `snz-bp theme` block to `src/styles.css`. Existing theme blocks are not replaced unless `--force` is passed.

CSS ownership: `src/styles.css` is the import shell. `src/styles/system.css` owns the editable token config + fluid engine; `reset.css`, `type.css`, `grid.css`, `wrappers.css`, and `motion.css` own their matching layers. Global primitives are `.c`, `.w`, `.btns`, `.lnks`, and grid attrs `[g]`, `[c]`, `[r]`, `[o]`. Use fixed grids like `g="4-2"` or auto grids `g="a"`, `g="a-sm"`, `g="a-lg"`. Component-specific selectors live in component `<style>` blocks.

Token legend: layout `--l-*`, space/radius/border `--s-*`, type `--t-*`, color/theme `--c-*`, motion `--m-*`, interaction `--i-*`, element roles `--e-*`. Use grouped tokens only: no short aliases. Themes use `data-theme="tone"` or `data-theme="invert"`; accent palettes use `data-accent="blue|green|pink|purple|orange|red|lime"`.

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

CMS support is opt-in and content-record focused. Run `bun run new cms` to create `.pages.yml`, `content/posts/`, `src/images/`, and `src/templates/post.html`. Authored pages stay in `src/pages/`; custom records use `bun run new collection`.

Custom collections are opt-in too. `snz-bp new collection projects --route work/{slug} --template project` creates `content/projects/`, `src/templates/project.html`, a `content/collections.json` compiler entry, and a matching `.pages.yml` editor entry. Omit flags for defaults: `route: projects/{slug}`, `template: project.html`.

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

Custom collections are optional via `content/collections.json`. Built-in `posts` stays implicit; `pages` is reserved so authored pages stay in `src/pages`. A custom collection declares its markdown folder, template file in `src/templates/`, public route pattern, and required front-matter fields:

```json
{
  "collections": [
    {
      "name": "projects",
      "label": "Projects",
      "path": "content/projects",
      "template": "project.html",
      "route": "work/{slug}",
      "required": ["title"]
    }
  ]
}
```

`content/projects/acme.md` then builds to `/work/acme/` through `src/templates/project.html`. Filename basename is the URL slug; front-matter `slug` overrides are not supported. Custom collections do not generate indexes, feeds, or tag pages by default.

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

Component `<script>` blocks become per-instance mount functions (see [`framework/docs/components.md`](./framework/docs/components.md) → Lifecycle scripts).

`src/app.ts` is the default site code entry and is bundled with `Bun.build`. Author code can use imports and TypeScript directly; starter projects include `src/snz.d.ts` for the `window.snz` API and `snz:page` events. `src/app.js` still works as an escape hatch, but do not keep both files; the build fails on ambiguous root app entries. Only `PUBLIC_*` env vars are inlined.

## Scroll

Lenis is optional and self-hosted (`src/app/vendor/lenis.min.js`). Toggle in `site.json`:

```jsonc
{ "scroll": "lenis" }   // default
{ "scroll": "native" }  // skip Lenis entirely
```

`prefers-reduced-motion: reduce` always disables it.

## Vercel deploys

Starter projects include `vercel.json` for Bun-first static deploys: `bun install`, `bun run build`, and `dist` output. `/assets/*` can be cached forever because built CSS/JS/images are content-hashed; discovery files use shorter cache headers.

`src/site.json` includes `vercel.analytics` and `vercel.speedInsights` flags as project intent only. They do not inject scripts or add packages. Enable Analytics/Speed Insights in Vercel deliberately, then wire any required script/package in the client project.

`track="Event name"` on components becomes `data-snz-track` in output. `snz.track(event, data?)` sends to Vercel Analytics when `window.va` exists; otherwise it dispatches `snz:track` so projects can attach another analytics adapter.

## Asset caching

`app.{hash}.js` and `components.{hash}.css` are content-hashed. Cache them forever — they invalidate when their contents change.

## Adding a page

1. Drop `src/pages/pricing.html` (or `bun run new route pricing`). Use nested files for nested URLs.
2. Optional `<head><SEO title="..." description="..." /></head>` wrapper.
3. Use components: `<Card><h2>...</h2><Button href="..." label="..." /></Card>`.
4. `bun run build`. Page is at `/pricing/`, in manifest, sitemap, llms.txt, and `/routes/pricing.json`.

## Adding a component

1. Read [`framework/docs/components.md`](./framework/docs/components.md).
2. Or copy [`framework/docs/component-prompt.md`](./framework/docs/component-prompt.md) and hand it to Claude.
3. Drop `src/components/MyThing.html`.
4. `bun run build`. Build refuses if the contract is violated.

## See also

- [`AGENTS.md`](./AGENTS.md) — orchestration guide for agents working in this repo.
- [`framework/docs/agent-guide.md`](./framework/docs/agent-guide.md) — quick framework mental model for LLMs.
- [`framework/docs/decisions/`](./framework/docs/decisions/) — architectural decisions worth knowing.
- Roadmap lives in GitHub Issues.
