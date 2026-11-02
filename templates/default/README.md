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
- project-owned Craft v3 CSS under `src/styles/`, imported by `src/styles.css`. No font files ship; text renders in `system-ui` until you add your own faces
- no CMS files until `bun run new cms`

Replace or extend `src/styles.css` and the copied `src/styles/` files for project CSS; the renderer links them automatically. Component `<style>` and route `<style>` blocks are optional.

Craft is optional project source; the renderer stays CSS-agnostic. `src/styles/global.css` imports flat `tokens.css` and `crft.css`, with adoption metadata in `crft-manifest.json`. The physical `crft` names remain. Existing sites receive no automatic CSS upgrade or compatibility aliases.

Use `.c` containers, optional `sm` or `lg` classes, `.s` vertical stacks, and type role classes such as `.lead`. Grids use `g`, `c`, `r`, and `o`; `l` clamps lines. `Section` keeps its `c` input for `sm` and `lg`, selecting container classes. `Grid` keeps `cols`, `x`, `y`, and `order`, emitting `g`, `c`, `r`, and `o`. Native `h4`–`h6` keep their semantics with `h3` styling.

`data-theme` accepts `invert`, `tone`, or `accent`; it and `data-accent` affect color only. Document CSS `color-scheme` chooses light or dark. Type, spacing, and radius recipes resolve at `:root`. Local CSS owns horizontal flow, wrapping, and alignment. Direct `main > section` elements need meaningful, unique IDs; sections have no classes.

Create source with `bun run new route about`, `bun run new component Hero`, and `bun run new cms`.

A route can declare metadata with the renderer-owned `<SEO />` directive:

```html
<head>
  <SEO title="About" description="What this organization does." image="/assets/images/about.webp" />
</head>

<Section id="about-section">
  <h1>About</h1>
</Section>
```

`SEO` has no component file. Canonical URLs derive from route filenames; `image` overrides the site-wide share image for one page.

Every route builds to a full HTML document, so navigation is native. The starter includes self-hosted Lenis. Set `"scroll": "lenis"` in `src/site.json` to include it. Set `"scroll": "native"` to exclude all Lenis files and markup from `dist/`. Reduced-motion users always keep native scrolling.

Build emits static pages, `404.html`, responsive images, sitemap, feeds, connected JSON-LD, manifests, route Markdown/JSON, same-path markdown aliases, and `llms.txt`. Replace `https://example.com`, the starter metadata in `src/site.json`, and the 1×1 `src/images/og.png` before launch; `bun run doctor -- --launch` fails on each of them.

A site created from the renderer checkout depends on `@snz/sttc` through a `file:` path; a site created from the npm package depends on `^<version>`.
