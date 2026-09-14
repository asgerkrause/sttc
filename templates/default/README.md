# STTC site

Minimal site starter powered by `@snz/sttc`.

```bash
bun install
bun run dev
```

Edit `src/`; never edit `dist/`. `AGENTS.md` lists every command.

## Starting surface

- `src/pages/index.html` and `src/pages/404.html`
- exactly `Header`, `Footer`, `Section`, `Logo`, `Image`, `Video`, and `Grid`
- `src/app.ts` for project TypeScript
- `src/site.json` for site and discovery defaults
- pinned CRFT CSS copied into project-owned `src/styles/` and imported by `src/styles.css`. Composition uses attributes (`c`, `s`, `t`, `g`, `x`, `y`, `o`, `l`). No font files ship; text renders in `system-ui` until you add your own faces
- no CMS files until `bun run new cms`

Replace or extend `src/styles.css` and the copied `src/styles/` files for project CSS; the renderer links them automatically. Component `<style>` and route `<style>` blocks are optional.

Create source with `bun run new route about`, `bun run new component Hero`, and `bun run new cms`.

A route can declare metadata with the renderer-owned `<SEO />` directive:

```html
<head>
  <SEO title="About" description="What this organization does." image="/assets/images/about.webp" />
</head>

<Section>
  <h1>About</h1>
</Section>
```

`SEO` has no component file. Canonical URLs derive from route filenames; `image` overrides the site-wide share image for one page.

Every route builds to a full HTML document, so navigation is native. The starter includes self-hosted Lenis. Set `"scroll": "lenis"` in `src/site.json` to include it. Set `"scroll": "native"` to exclude all Lenis files and markup from `dist/`. Reduced-motion users always keep native scrolling.

Build emits static pages, `404.html`, responsive images, sitemap, feeds, connected JSON-LD, manifests, route Markdown/JSON, same-path markdown aliases, and `llms.txt`. Replace `https://example.com`, the starter metadata in `src/site.json`, and the 1×1 `src/images/og.png` before launch; `bun run doctor -- --launch` fails on each of them.

`@snz/sttc` is unpublished. A site created from the renderer checkout depends on it through a `file:` path; a site created from a packed tarball depends on `^<version>` and cannot install until a human publishes the package.
