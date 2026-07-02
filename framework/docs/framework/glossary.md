# Glossary

## app entry

`src/app.ts` or `src/app.js`. Site code bundled with `Bun.build`. Do not keep both root entries.

## component

Build-time HTML file in `src/components/PascalName.html`. Can declare attributes, slots, styles, scripts, and schema metadata.

## component schema

Leading HTML comment in a component file. Uses directives such as `@desc`, `@attr`, and `@schema`.

## content collection

Markdown content source. Built-in content is `content/posts`; authored pages live in `src/pages`. Custom collections can be declared in `content/collections.json`.

## discovery artifacts

Machine-readable outputs such as sitemap, robots, feeds, llms files, manifest, route JSON, plugin manifest, and JSON-LD.

## `dist/`

Generated static site output. Never edit directly.

## global CSS

CSS under `src/styles.css` and `src/styles/*.css`. Owns tokens, reset, type, grid, wrappers, motion, and page overrides.

## grid primitives

Attribute-based layout system:

- `[g]` grid container;
- `[c]` column span;
- `[r]` row span;
- `[o]` visual order.

## lifecycle script

Optional `<script>` block inside a component. Runs once per mounted component instance with `el` bound to component root. May return cleanup function.

## page

HTML route source under `src/pages/**/*.html`.

## route

Public URL generated from a page, legacy route, content file, or generated index. Examples: `/`, `/about/`, `/insights/post/`.

## route fragment

Generated HTML body fetched by router from `/routes/{slug}.html` during client navigation.

## router

Client runtime in `framework/runtime/router.js`. Exposes `window.snz` for navigation, page hooks, route prefetch, and navigation guards.

## shell

`src/shell.html`. Outer page wrapper loaded by browser. Contains shared document structure and `<main data-route-root>`.

## slot

Placeholder in component template. `{{slot}}` receives default children. `{{slot:name}}` receives children from `<slot name="name">`.

## strict check

Build validation that fails on source errors such as missing required attrs, unknown components, forbidden route styles, broken internal links, and duplicate slugs.

## token

CSS custom property from design system. Common grouped tokens include `--l-mw`, `--s-px`, `--s-py`, `--s-gp`, `--s-pd`, `--s-br`, `--c-bg`, `--c-ink`, `--c-sur`, `--c-bor`, `--c-acc`, and `--c-acc-ink`. Old short tokens are removed.

## Next

[Framework philosophy](./18-framework-philosophy.md) · [Docs home](./README.md)
