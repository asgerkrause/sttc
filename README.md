# STTC

STTC (`@snz/sttc`) is an HTML-first static site renderer for Bun. You write routes and components as plain HTML files. The build turns them into a static `dist/` folder with one full HTML document per route, responsive images, and SEO and discovery files.

STTC fits small brochure, marketing, and studio sites that should ship as static files. It is not a wrapper around React, Vue, Svelte, or Vite. It has no virtual DOM, no hydration, and no client router. Navigation is native page loads, with speculation-rules prefetch and optional cross-document view transitions.

## Requirements

- [Bun](https://bun.sh) 1.4.0 or later. STTC runs on Bun only; it does not support Node or npm scripts.

## Quick start

```bash
bunx @snz/sttc create my-site
cd my-site
bun install
bun run dev
```

`create` copies the starter into a new or empty directory and refuses to write into a non-empty one. `bun run dev` builds the site, serves `dist/` on `http://127.0.0.1:3000`, and reloads the tab after each rebuild.

## Features

- **HTML routes.** Each file under `src/pages/` becomes a route: `src/pages/about.html` builds to `/about/`.
- **Build-time components.** One `src/components/PascalCase.html` file per component, with declared attributes, slots, `{#if}` and `{#each}` blocks, an optional lifecycle `<script>`, and an optional colocated `<style>`. A malformed component fails the build and names the file and page.
- **SEO and discovery output.** A route sets `title`, `description`, and an optional `image` through `<SEO />`. Site defaults come from `src/site.json`. The build emits canonical and Open Graph tags, JSON-LD, a sitemap, `llms.txt`, `llms-full.txt`, Markdown and JSON versions of each route, and RSS and JSON feeds once a public post exists.
- **Images.** `<Image src="hero" alt="…" />` turns a master in `src/images/` into WebP files with responsive variants and intrinsic dimensions.
- **Optional content.** `bun run new cms` adds Markdown posts, tags, feeds, custom collections, and a PagesCMS configuration.
- **Checks.** `bun run build` ends with `check`, which fails on broken internal links, unresolved placeholders, and missing discovery output. `bun run doctor -- --launch` also rejects the starter's placeholder URL, metadata, and share image.
- **Small runtime.** `window.snz` mounts component scripts and dispatches `snz:page` and `snz:track` events. It loads no analytics provider.
- **Project-owned CSS.** The renderer adds no CSS. The starter includes a copy of the Craft v3 CSS system in `src/styles/`, which you can change or delete.

## Project layout

A site created with `create` has this source layout:

```text
src/
  shell.html        document shell
  site.json         site name, URL, and SEO defaults
  app.ts            project TypeScript entry
  styles.css        project CSS entry
  styles/           project-owned Craft v3 CSS
  pages/            routes (index.html, 404.html)
  components/       Header, Footer, Section, Logo, Image, Video, Grid
  images/           image masters
  videos/           public video files
  files/            public raw files
content/            optional Markdown records, added by `bun run new cms`
dist/               build output; do not edit
```

A route can start with a `<head>` wrapper that holds its `<SEO />` directive:

```html
<head>
  <SEO title="About" description="What this organization does." />
</head>

<Section id="about">
  <h1>About</h1>
  <p>Page content.</p>
</Section>
```

A component declares its contract in a leading comment:

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

## Commands

Run these inside a created site:

| Command | Effect |
|---|---|
| `bun run dev` | Build on change and serve `dist/` with live reload on port 3000. |
| `bun run build` | Build `dist/`, then run `check`. |
| `bun run preview` | Serve the built `dist/` on port 4173 with gzip and cache headers. |
| `bun run check` | Check renderer contracts in `dist/`. |
| `bun run doctor` | Typecheck, then run `check`. Add `-- --launch` for the production gate. |
| `bun run new route pricing` | Add `src/pages/pricing.html`. |
| `bun run new component Hero` | Add `src/components/Hero.html`. |
| `bun run new cms` | Add the content and PagesCMS files. |

## Documentation

- [Components](./framework/docs/framework/components.md)
- [Runtime](./framework/docs/framework/runtime.md)
- [SEO, AEO, and GEO](./framework/docs/framework/seo-aeo-geo.md)
- [Content and CMS](./framework/docs/framework/content-and-cms.md)
- [Images](./framework/docs/framework/images.md)
- [Deploy and launch](./framework/docs/framework/deploy-and-launch.md)
- [Design decisions](./framework/docs/decisions/README.md)

## Working on STTC

This repository is both the renderer and a site built with it. `framework/` holds the renderer, `templates/default/` is the starter that `create` copies, and `src/` is the project's own site. [`AGENTS.md`](./AGENTS.md) lists the full command set and source contracts.

```bash
bun install
bun run framework:verify
```

`framework:verify` typechecks, runs `check`, runs the framework tests, and creates a site from the starter as a smoke test.

## License

STTC is released under the [MIT License](./LICENSE).

The site in this repository uses two fonts under the SIL Open Font License 1.1: Inter (`src/styles/sans.woff`) and Geist Mono (`src/styles/mono.woff`). Their notices and license are in [`src/styles/OFL.txt`](./src/styles/OFL.txt). The starter ships no font files.
