# Project structure

Common paths in `@snz/bp` projects.

| Path | Purpose |
| --- | --- |
| `src/shell.html` | App shell: header, main mount, footer, shared scripts. |
| `src/pages/**/*.html` | Static routes. One file maps to one URL. |
| `src/components/*.html` | Build-time components with optional inline schema, style, and script. |
| `src/site.json` | Site config: name, URL, description, OG image, locale, scroll mode. |
| `src/styles.css` | Global CSS import shell. |
| `src/styles/*.css` | Tokens, reset, type, grid, wrappers, motion. |
| `src/app.ts` | Default site code entry, bundled with Bun. |
| `src/app.js` | JavaScript escape hatch; do not keep with `src/app.ts`. |
| `src/images/` | Source image masters. |
| `src/routes/**/*.html` | Legacy route input. `src/pages` wins on collisions. |
| `src/templates/{post,page}.html` | Optional CMS render templates. |
| `content/posts/*.md` | Optional posts, built under `/insights/{slug}/`. |
| `content/pages/*.md` | Optional pages, built under `/{slug}/`. |
| `content/collections.json` | Optional custom content collection config. |
| `src/images/` | Optional CMS image uploads. |
| `framework/runtime/router.js` | Client router and `window.snz` API. |
| `framework/runtime/lib/paths.js` | Shared path helpers for build and router. |
| `framework/build/` | Build pipeline. |
| `.snz/` | Local cache/state only; never source code. |
| `framework/dev.ts` | Dev server. |
| `framework/docs/` | Framework, authoring, and decision docs. |
| `templates/default/` | Starter project template. |
| `dist/` | Generated site output. Never edit. |

## Route files

Route files contain body markup. Optional top `<head>` wrapper sets route SEO and transition metadata:

```html
<head>
  <SEO title="About" description="About this site." />
  <meta name="snz:transition" content="fade">
</head>

<Section>
  <h1>About</h1>
</Section>
```

Rules:

- `src/pages/index.html` → `/`.
- `src/pages/about.html` → `/about/`.
- `src/pages/blog/index.html` → `/blog/`.
- `src/pages/work/case.html` → `/work/case/`.
- `src/pages/404.html` → 404 page.
- Inline `<script>` allowed only at top of route.
- `<style>` in routes is forbidden.

## Component files

One component is one file:

```txt
src/components/Card.html
src/components/Feature.html
src/components/Testimonials.html
```

Use component `<style>` for component-specific selectors. Global CSS owns tokens, reset, type, grid, wrappers, and page overrides.

## CSS ownership

Global CSS owns:

- tokens and themes;
- base element styles;
- type utilities;
- `.c`, `.w`, `.crd`, `.btns`, `.lnks`;
- `[g]`, `[c]`, `[r]`, `[o]` grid primitives;
- page overrides like `html[data-page="about"]`.

Component CSS owns private roots such as `.faq`, `.code`, `.img-w`, and component composition details.

## Output files

Every build may emit:

- HTML pages;
- hashed CSS and JS assets;
- responsive image assets;
- `/routes/{slug}.html` and `/routes/{slug}.json`;
- `/site.manifest.json`;
- `/sitemap.xml` and `/robots.txt`;
- `/feed.xml` and `/feed.json` when posts exist;
- `/llms.txt` and `/llms-full.txt`;
- `/.well-known/ai-plugin.json`.

## Next

[Quickstart](./01-quickstart.md) · [Docs home](./README.md) · [Pages and routing](./03-pages-and-routing.md)
