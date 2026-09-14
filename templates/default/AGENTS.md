# AGENTS.md — SANITIZE site

This project uses `@snz/sttc`, an HTML-first Bun renderer. Edit `src/` and optional `content/`. Never edit generated `dist/` or put source in `.snz/`.

Use Bun only.

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
```

`build` runs `check` at the end. `doctor` typechecks, then runs `check`; `--launch` adds the production gate.

## Source

- `src/shell.html`: document shell with Header, Main, Footer, and a speculation-rules prefetch block.
- `src/pages/**/*.html`: file-based routes; each becomes a full HTML document.
- `src/components/*.html`: one PascalCase component per file.
- `src/site.json`: site, SEO, AEO, GEO, and discovery defaults.
- `src/app.ts`: project browser code.
- `src/images/`, `src/videos/`, `src/files/`: public media sources.

The starter contains exactly `Header`, `Footer`, `Section`, `Logo`, `Image`, `Video`, and `Grid`. Replace them freely.

## SEO directive

Use `<SEO title="…" description="…" image="…" />` inside an optional route `<head>` wrapper. It is renderer-owned, not a component file, and is accepted only in that wrapper. Canonical URLs derive from route filenames. The build emits canonical metadata, Open Graph, Twitter cards, connected JSON-LD, sitemap, feeds, route Markdown/JSON, same-path markdown aliases, manifests, llms files, and `dist/404.html`.

## Components

Declare attrs in the leading comment. Use `{{attr}}`, `{{slot}}`, named slots, `{#if}` / `{:else if}` / `{:else}` (nesting allowed), optional build-time `{#each}`, optional lifecycle `<script>`, optional colocated `<style>`, and optional `@schema` metadata. Attribute values use double quotes; a single-quoted attribute fails the build and names the tag. Behavior required by a component belongs in that component's lifecycle script, not `src/app.ts`. Runtime scripts receive `el` and must return cleanup when they register listeners or active work.

## Runtime

Navigation is native: every link is a full document load, the browser restores scroll on back, and anchors scroll on arrival. Cross-document view transitions come from `src/styles/layers/motion.css`. `window.snz` provides `page`, `onPage`, `registerComponent`, `track`, `onVisible`, `onActive`, `isVisible`, and `isActive`, dispatches `snz:page` once per document, and handles buttons with `aria-controls` and `aria-expanded`. There is no `navigate`, `prefetch`, or navigation hook.

`track="Event name"` on a component compiles to `data-snz-track`; a click calls `snz.track()`, which dispatches `snz:track` on `document`. The runtime injects no analytics script. Subscribe in `src/app.ts` and forward to the project's provider (PostHog, Vercel Analytics, or another).

## CSS

The starter imports a pinned, project-owned CRFT copy from `src/styles/`. Layers are `reset`, `base`, `tokens`, `type`, `layout`, `grid`, `motion`, and `utility`. No font files ship: text renders in `system-ui` until the project adds `@font-face` rules and WOFF/WOFF2 files under `src/styles/`; the build hashes those files and rewrites their URLs. Attributes are the composition API: `c`, `s`, `t`, `g`, `x`, `y`, `o`, `l`. Weight flags on `t` are `lt`, `rg`, and `bo`. Family flags are `sa`, `se`, `mo`, `fb`, and `dp`. `data-skin`, `data-accent`, and `data-scrub` own canvas and opt-in behavior. Classes own override and product use. Replace or delete that import and copy when the project adopts another system. Component and route styles remain optional. Use at most one stable root class per component; style descendants with nested semantic or data-attribute selectors instead of inner classes. Do not invent framework tokens or utility classes.

Lenis smooth scrolling is optional and self-hosted. Set `"scroll": "lenis"` in `src/site.json` to include it. Set `"scroll": "native"` to exclude its bootstrap, CSS, vendor code, and shell configuration from `dist/`. Reduced-motion users always keep native scrolling.

## Verification

Run `bun run build` after structural edits and `bun run doctor -- --launch` before handoff. `check` fails only on renderer contracts; stylesheet count, non-deferred head scripts, and `@import` in emitted CSS warn under `--launch`. Launch mode rejects the placeholder URL, the 1×1 `og.png`, and the starter's name, description, and home title; never fabricate production values. Measure Lighthouse against `bun run preview` or the production origin, not `bun run dev`.

`vercel.json` ships with Vercel build settings and cache headers; only hashed `css|js|woff` assets are immutable.
