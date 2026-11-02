# STTC

`@snz/sttc` is an HTML-first, Bun-native static site renderer. Authors write routes, atomic components, TypeScript, images, and optional markdown content. The build emits a static `dist/` site with one full document per route, responsive images, SEO/AEO/GEO metadata, feeds, manifests, discovery files, and strict launch checks.

It is not a React, Vue, Svelte, or Vite wrapper. There is no virtual DOM, hydration layer, or client router: navigation is native, with cross-document view transitions and speculation-rules prefetch from project source. Presentation is project-owned. The starter includes Craft v3 CSS in `src/styles/`; you may replace or delete that copy. The renderer has no Craft dependency.

## Requirements

- Bun >= 1.4.0
- Bun only; no npm commands

Commands, the source tree, and the verification loop are in [`AGENTS.md`](./AGENTS.md). A site created from this checkout resolves `@snz/sttc` with a `file:` dependency; a site created from the npm package depends on `^<version>`.

## Starter surface

```text
src/
  shell.html
  site.json
  app.ts
  snz.d.ts
  styles.css
  styles/
    global.css
    tokens.css
    crft.css
    crft-manifest.json
  pages/
    index.html
    404.html
  components/
  images/
    og.png
```

The starter ships seven replaceable HTML components (named in `AGENTS.md`), not a UI library, and no font files: a created site renders in `system-ui` until the project adds its own faces.

Craft is the system name; `crft.css` and `crft-manifest.json` retain their physical names. Project-owned `src/styles/global.css` imports flat `tokens.css` and `crft.css`; `src/styles.css` imports that entry. The eight logical layers remain unchanged. Existing consumer copies receive no automatic upgrade, and the migration adds no compatibility aliases. See [Craft v3 adoption](./framework/docs/decisions/craft-v3-adoption.md).

Containers use `.c` with optional `sm` or `lg` classes. `.s` owns vertical stacks; type roles use classes such as `.lead` and `.small`. Grids use `g` tracks, `c` column spans, `r` row spans, and `o` visual order; `l` clamps lines. Native headings retain their semantics, with `h4`–`h6` using `h3` styling. `Section` keeps its `c` input for `sm` and `lg`. `Grid` keeps `cols`, `x`, `y`, and `order`, emitting `g`, `c`, `r`, and `o`.

`data-theme` accepts `invert`, `tone`, or `accent`; it and `data-accent` affect color only. Set light or dark preference through document CSS `color-scheme`. Shared type, spacing, and radius recipes resolve at `:root`. Bounded project CSS owns horizontal flow, wrapping, and alignment. Direct `main > section` elements need meaningful, unique IDs; sections have no classes.

The build flattens the CSS import tree into one hashed stylesheet. Component-specific `<style>` blocks compile into one pruned hashed stylesheet. Route `<style>` blocks compile into route-owned assets.

## Pages

Files under `src/pages/` become routes:

```text
src/pages/index.html       /
src/pages/about.html       /about/
src/pages/work/case.html   /work/case/
```

```html
<head>
  <SEO title="About" description="What this organization does." image="/assets/images/about.webp" />
</head>

<Section id="intro">
  <h1>About</h1>
  <p>Page content.</p>
</Section>
```

`<SEO />` is handled by the renderer inside the route's leading `<head>` wrapper. Set `title`, `description`, and optional page-specific `image`; canonical URLs derive from route filenames. It merges route values with `src/site.json` and emits title, description, canonical, Open Graph, Twitter metadata, and JSON-LD. Existing `ogImage` values remain a compatibility alias for `image`.

## Components

One component is one PascalCase HTML file:

```html
<!-- src/components/Hero.html -->
<!--
  @desc Introductory content block.
  @attr id! Meaningful section id.
  @attr title! Visible heading.
-->
<section id="{{id}}">
  <h1>{{title}}</h1>
  <div>{{slot}}</div>
</section>
```

Use it in a route:

```html
<Hero id="intro" title="A faster starting point">Project-owned content.</Hero>
```

Components support declared attrs, default and named slots, nested `{#if}` / `{:else if}` / `{:else}`, build-time `{#each}` data, optional lifecycle `<script>`, optional colocated `<style>`, and `@schema` JSON-LD declarations. See [`framework/docs/framework/components.md`](./framework/docs/framework/components.md).

## Images and public media

Place image masters in `src/images/`:

```html
<Image src="hero" alt="Product interface" max="1600" quality="82" />
```

Bun emits WebP output, responsive variants, intrinsic dimensions, and native `srcset`, `sizes`, loading, and decoding attributes. `Video` renders native video; public video files copy from `src/videos/` to `/assets/videos/`. Raw downloads copy from `src/files/` to `/assets/files/`.

## Content

CMS support is opt-in through `bun run new cms`, `bun run new post`, and `bun run new collection`. Posts, tags, feeds, collection routes, drafts, PagesCMS configuration, and collision checks remain renderer-owned. `posts` is an ordinary collection whose route and templates a project may override. Authored pages always live in `src/pages/`. See [`framework/docs/framework/content-and-cms.md`](./framework/docs/framework/content-and-cms.md).

## Smart output

Every build emits:

- one full HTML document per route, plus `dist/404.html`;
- sitemap and robots;
- RSS and JSON Feed when a public post exists;
- `llms.txt` and `llms-full.txt`;
- `site.manifest.json` and per-route JSON;
- `site.jsonld`, baseline JSON-LD, and component-declared JSON-LD;
- Markdown and JSON representations for each public route, plus same-path markdown aliases such as `/about/index.md`;
- hashed TypeScript, component-style, and route-style assets when present.

## Runtime

The page runtime on `window.snz` mounts component lifecycle scripts, reports the page (`snz:page`), tracks events (`snz:track`), and manages visibility, active media, and native disclosures. It injects no analytics; providers subscribe to `snz:track` in `src/app.ts`. See [`framework/docs/framework/runtime.md`](./framework/docs/framework/runtime.md).

## Optional smooth scrolling

The starter includes self-hosted Lenis. Set `"scroll": "lenis"` in `src/site.json` to include it. Set `"scroll": "native"` to remove the Lenis bootstrap, stylesheet, and vendor script from `dist/`. Reduced-motion users always keep native scrolling.

## Source ownership

- Edit `src/` and optional `content/` for sites.
- Edit `framework/` for renderer behavior.
- `templates/default/` is the created-project template shipped by `@snz/sttc`.
- `sttc create <project-dir>` copies that template without mirror or sync machinery.
- `.snz/` is cache/state only, including `.snz/components-catalog.md`.
- Never edit `dist/`.

`bun run framework:verify` runs strict checks, typechecking, framework tests, and one-package creator smoke coverage. Publishing and deploying require explicit human approval.
