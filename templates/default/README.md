# STTC site

Minimal site starter powered by `@snz/sttc`.

```bash
bun install
bun run dev
bun run build
bun run check
bun run doctor -- --launch
```

Edit `src/`; never edit `dist/`.

## Starting surface

- `src/pages/index.html` and `src/pages/404.html`
- exactly `Header`, `Footer`, `Section`, `Logo`, `Image`, `Video`, and `Grid`
- `src/app.ts` for project TypeScript
- `src/site.json` for site and discovery defaults
- pinned CRFT CSS copied into project-owned `src/styles/` and imported by `src/styles.css`
- no CMS files until `bun run new cms`

Replace or extend `src/styles.css` and the copied `src/styles/` files for project CSS; the renderer links them automatically. Component `<style>` and route `<style>` blocks are optional.

Create source with:

```bash
bun run new route about
bun run new component Hero
bun run new cms
```

A route can declare metadata with the renderer-owned `<SEO />` directive:

```html
<head>
  <SEO title="About" description="What this organization does." image="/assets/images/about.webp" />
</head>

<Section>
  <h1>About</h1>
</Section>
```

`SEO` is a renderer directive, not a component file. Canonical URLs derive from route filenames; `image` overrides the site-wide share image for one page.

The starter includes self-hosted Lenis. Set `"scroll": "lenis"` in `src/site.json` to include it. Set `"scroll": "native"` to exclude all Lenis files and markup from `dist/`. Reduced-motion users always keep native scrolling.

Build emits static pages, responsive images, sitemap, feeds, connected JSON-LD, manifests, route Markdown/JSON, and `llms.txt`. Replace `https://example.com` and starter metadata in `src/site.json` before launch.
