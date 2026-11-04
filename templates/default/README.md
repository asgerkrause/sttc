# STTC site

This site is built with [`@byak/sttc`](https://github.com/asgerkrause/sttc), an HTML-first static renderer for Bun. It requires Bun 1.4.0 or later.

```bash
bun install
bun run dev
```

`bun run dev` serves the site on `http://127.0.0.1:3000` by default and reloads the tab after each rebuild. Edit `src/`; never edit `dist/`. `AGENTS.md` lists every command and source contract.

## Starter contents

- `src/pages/index.html` and `src/pages/404.html`.
- Seven replaceable components: `Header`, `Footer`, `Section`, `Logo`, `Image`, `Video`, and `Grid`.
- `src/app.ts` for project TypeScript.
- `src/site.json` for the site name, URL, and SEO defaults.
- A project-owned copy of the Craft v3 CSS system under `src/styles/`, imported by `src/styles.css`.
- No font files. Text renders in `system-ui` until you add your own `@font-face` rules and WOFF or WOFF2 files under `src/styles/`.
- No CMS files. Run `bun run new cms` to add them.

Add source with `bun run new route about` and `bun run new component Hero`.

Agents can use `bun run build --json` or `bun run check --json` for one versioned result with errors and warnings. `check` builds first; `--skip-build` checks existing output. Require both a zero exit status and a valid success result. Run `bun run typecheck` separately: the `doctor` script includes compiler output outside the JSON protocol.

## Pages and SEO

Each file in `src/pages/` becomes a full HTML document, so navigation uses native page loads. A route can set its metadata in a leading `<head>` wrapper:

```html
<head>
  <SEO title="About" description="What this organization does." image="/assets/images/about.webp" />
</head>

<Section id="about-section">
  <h1>About</h1>
</Section>
```

`SEO` is a renderer directive, not a component file. Canonical URLs derive from route filenames. `image` overrides the site-wide share image for one page.

The build emits static pages, `404.html`, responsive images, a sitemap, connected JSON-LD, manifests, Markdown and JSON versions of each route, `llms.txt`, and `llms-full.txt`. It adds RSS and JSON feeds once a public post exists.

## CSS

The renderer adds no CSS and links `src/styles.css` automatically. Change or replace the files under `src/styles/` as needed. Component and route `<style>` blocks are optional.

Craft conventions in the starter:

- `.c` containers, with optional `sm` or `lg` classes, and `.s` vertical stacks.
- Type role classes such as `.lead` and `.small`. Native `h4` to `h6` keep their semantics with `h3` styling.
- Grids use `g` tracks, `c` column spans, `r` row spans, and `o` visual order. `l` clamps lines.
- `Section` takes a `c` input (`sm` or `lg`) that selects the container class. `Grid` takes `cols`, `x`, `y`, and `order` and emits `g`, `c`, `r`, and `o`.
- `data-theme` accepts `invert`, `tone`, or `accent`. It and `data-accent` change color only. CSS `color-scheme` on `:root` chooses light or dark.
- Direct `main > section` elements need meaningful, unique IDs. Sections take no classes.

## Smooth scrolling

The starter includes self-hosted Lenis. Set `"scroll": "lenis"` in `src/site.json` to include it. Set `"scroll": "native"` to remove every Lenis file and its markup from `dist/`. Reduced-motion users always keep native scrolling.

## Before launch

Replace `https://example.com`, the starter name and description in `src/site.json`, the starter title in `src/pages/index.html`, and the 1×1 placeholder `src/images/og.png`. `bun run doctor -- --launch` fails until each one is replaced.
