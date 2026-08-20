# STTC

`@snz/sttc` is an HTML-first, Bun-native static site renderer. Authors write routes, atomic components, TypeScript, images, and optional markdown content. The build emits a static `dist/` site with routing, responsive images, SEO/AEO/GEO metadata, feeds, manifests, discovery files, and strict launch checks.

It is not a React, Vue, Svelte, or Vite wrapper. There is no virtual DOM or hydration layer. Presentation is project-owned. The starter copies pinned CRFT CSS into `src/styles/` and you may replace or delete that copy.

## Requirements

- Bun >= 1.3.14
- Bun only; no npm commands

## Commands

```bash
bun run dev
bun run preview
bun run build
bun run check
bun run doctor
bun run doctor -- --launch
bun run new route pricing
bun run new component Hero
bun run new cms
bun run skills sync
```

`doctor` runs strict checks; the package script also typechecks. Launch mode adds public URL, metadata, heading, alt-text, link-label, and production-readiness gates. Builds print one concise result by default; pass `--profile` for phase timings.

## Starter surface

```text
src/
  shell.html
  site.json
  app.ts
  snz.d.ts
  styles.css
  styles/
    sans.woff
    mono.woff
  pages/
    index.html
    404.html
  components/
    Header.html
    Footer.html
    Section.html
    Logo.html
    Image.html
    Video.html
    Grid.html
  images/
    og.png
```

The starter ships exactly `Header`, `Footer`, `Section`, `Logo`, `Image`, `Video`, and `Grid`. They are replaceable HTML examples, not a UI library. `SEO` remains a renderer directive.

The starter copies pinned CRFT CSS into project-owned `src/styles/`. Replace or delete it freely. Composition uses attributes (`c`, `s`, `t`, `g`, `x`, `y`, `o`, `l`), not a class matrix. The build flattens that import tree into one hashed stylesheet. Component-specific `<style>` blocks compile into one pruned hashed stylesheet. Route `<style>` blocks compile into route-owned assets.

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

`<SEO />` is a renderer directive, not a component file. Set `title`, `description`, and optional page-specific `image`; canonical URLs derive from route filenames. It merges route values with `src/site.json` and emits title, description, canonical, Open Graph, Twitter metadata, and JSON-LD. Existing `ogImage` values remain a compatibility alias for `image`.

## Components

One component is one PascalCase HTML file:

```html
<!-- src/components/Hero.html -->
<!--
  @desc Introductory content block.
  @attr title! Visible heading.
-->
<section>
  <h1>{{title}}</h1>
  <div>{{slot}}</div>
</section>
```

Use it in a route:

```html
<Hero title="A faster starting point">Project-owned content.</Hero>
```

Components support declared attrs, default and named slots, `{#if}` / `{:else}`, build-time `{#each}` data, optional lifecycle `<script>`, optional colocated `<style>`, and `@schema` JSON-LD declarations. See [`framework/docs/framework/05-components.md`](./framework/docs/framework/05-components.md).

## Images and public media

Place image masters in `src/images/`:

```html
<Image src="hero" alt="Product interface" max="1600" quality="82" />
```

Bun emits WebP output, responsive variants, intrinsic dimensions, and native `srcset`, `sizes`, loading, and decoding attributes. `Video` renders native video; public video files copy from `src/videos/` to `/assets/videos/`. Raw downloads copy from `src/files/` to `/assets/files/`.

## Content

CMS support is opt-in:

```bash
bun run new cms
bun run new post hello-world
bun run new collection projects --route work/{slug} --template project
```

Posts, tags, feeds, collection routes, drafts, PagesCMS configuration, and collision checks remain renderer-owned. Authored pages always live in `src/pages/`.

## Smart output

Every build emits:

- static public pages and router fragments;
- sitemap and robots;
- RSS and JSON Feed;
- `llms.txt` and `llms-full.txt`;
- `site.manifest.json` and per-route JSON;
- `site.jsonld`, baseline JSON-LD, and component-declared JSON-LD;
- Markdown and JSON representations for each public route, plus same-path markdown aliases such as `/about/index.md`;
- hashed TypeScript, component-style, and route-style assets when present.

## Optional smooth scrolling

The starter includes self-hosted Lenis. Set `"scroll": "lenis"` in `src/site.json` to include it. Set `"scroll": "native"` to remove the Lenis bootstrap, stylesheet, and vendor script from `dist/`. Reduced-motion users always keep native scrolling.

## Source ownership

- Edit `src/` and optional `content/` for sites.
- Edit `framework/` for renderer behavior.
- `templates/default/` is the created-project template shipped by `@snz/sttc`.
- `sttc create <project-dir>` copies that template without mirror or sync machinery.
- `.snz/` is cache/state only, including `.snz/components-catalog.md` and `.snz/migrations.json`.
- Never edit `dist/`.

## Verification

```bash
bun run framework:verify
```

This runs strict checks, typechecking, framework tests, and one-package creator smoke coverage. Publishing, deploying, and removing private package guards require explicit human approval.
