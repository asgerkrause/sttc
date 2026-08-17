# AGENTS.md — SANITIZE site

This project uses `@snz/sttc`, an HTML-first Bun renderer. Edit `src/` and optional `content/`. Never edit generated `dist/` or put source in `.snz/`.

Use Bun only.

```bash
bun run dev
bun run build
bun run check
bun run doctor
bun run doctor -- --launch
bun run new route pricing
bun run new component Hero
bun run new cms
```

## Source

- `src/shell.html`: persistent Header/Main/Footer document.
- `src/pages/**/*.html`: file-based routes.
- `src/components/*.html`: one PascalCase component per file.
- `src/site.json`: site, SEO, AEO, GEO, and discovery defaults.
- `src/app.ts`: project browser code.
- `src/images/`, `src/videos/`, `src/files/`: public media sources.

The starter contains exactly `Header`, `Footer`, `Section`, `Logo`, `Image`, `Video`, and `Grid`. Replace them freely.

## SEO directive

Use `<SEO title="…" description="…" image="…" />` inside an optional route `<head>` wrapper. It is renderer-owned, not a component file. Canonical URLs derive from route filenames. The build automatically emits canonical metadata, Open Graph, Twitter cards, connected JSON-LD, sitemap, feeds, route Markdown/JSON, manifests, and llms files.

## Components

Declare attrs in the leading comment. Use `{{attr}}`, `{{slot}}`, named slots, `{#if}`, optional build-time `{#each}`, optional lifecycle `<script>`, optional colocated `<style>`, and optional `@schema` metadata. Behavior required by a component belongs in that component's lifecycle script, not `src/app.ts`. Runtime scripts receive `el` and must return cleanup when they register listeners or active work.

## CSS

The starter imports a pinned, project-owned CRFT copy from `src/styles/`. Replace or delete that import and copy when the project adopts another system. Component and route styles remain optional. Use at most one stable root class per component; style descendants with nested semantic or data-attribute selectors instead of inner classes. Do not invent framework tokens or utility classes.

Lenis smooth scrolling is optional and self-hosted. Set `"scroll": "lenis"` in `src/site.json` to include it. Set `"scroll": "native"` to exclude its bootstrap, CSS, vendor code, and shell configuration from `dist/`. Reduced-motion users always keep native scrolling.

## Verification

Run `bun run build` after structural edits and `bun run doctor -- --launch` before handoff. Launch mode rejects placeholder URLs and incomplete metadata; never fabricate production values.
