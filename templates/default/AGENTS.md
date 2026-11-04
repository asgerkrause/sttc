# AGENTS.md — STTC site

This project uses `@byak/sttc`, an HTML-first Bun renderer. Edit `src/` and optional `content/`. Never edit generated `dist/` or put source in `.snz/`.

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

Use `bun run build --json` or `bun run check --json` for machine-readable errors and warnings. Require exit status zero and a valid version 1 success result; missing or truncated output is not success. `check` builds first unless `--skip-build` is set. Run `bun run typecheck` separately from JSON checks; the `doctor` script also emits compiler output.

## Source

- `src/shell.html`: document shell with Header, Main, Footer, and a speculation-rules prefetch block.
- `src/pages/**/*.html`: file-based routes; each becomes a full HTML document.
- `src/components/*.html`: one PascalCase component per file.
- `src/site.json`: site, SEO, AEO, GEO, and discovery defaults.
- `src/app.ts`: project browser code.
- `src/styles.css`: project CSS entry, importing `src/styles/global.css`.
- `src/styles/`: project-owned Craft v3 CSS and adoption manifest.
- `src/images/`, `src/videos/`, `src/files/`: public media sources.

The starter contains exactly `Header`, `Footer`, `Section`, `Logo`, `Image`, `Video`, and `Grid`. Replace them freely.

## SEO directive

Use `<SEO title="…" description="…" image="…" />` inside an optional route `<head>` wrapper. It is renderer-owned, not a component file, and is accepted only in that wrapper. Canonical URLs derive from route filenames. The build emits canonical metadata, Open Graph, Twitter cards, connected JSON-LD, sitemap, feeds, route Markdown/JSON, same-path markdown aliases, manifests, llms files, and `dist/404.html`.

## Components

Declare attrs in the leading comment. Use `{{attr}}`, `{{slot}}`, named slots, `{#if}` / `{:else if}` / `{:else}` (nesting allowed), optional build-time `{#each}`, optional lifecycle `<script>`, optional colocated `<style>`, and optional `@schema` metadata. Attribute values use double quotes; a single-quoted attribute fails the build and names the tag. Behavior required by a component belongs in that component's lifecycle script, not `src/app.ts`. Runtime scripts receive `el` and must return cleanup when they register listeners or active work.

## Runtime

Navigation is native: every link is a full document load, the browser restores scroll on back, and anchors scroll on arrival. Cross-document view transitions come from the motion layer in project-owned `src/styles/crft.css`. `window.snz` provides `page`, `onPage`, `registerComponent`, `track`, `onVisible`, `onActive`, `isVisible`, and `isActive`, dispatches `snz:page` once per document, and handles buttons with `aria-controls` and `aria-expanded`. There is no `navigate`, `prefetch`, or navigation hook.

`track="Event name"` on a component compiles to `data-snz-track`; a click calls `snz.track()`, which dispatches `snz:track` on `document`. The runtime injects no analytics script. Subscribe in `src/app.ts` and forward to the project's provider (PostHog, Vercel Analytics, or another).

## CSS

The renderer is CSS-agnostic. The starter explicitly adopts project-owned Craft v3 CSS under `src/styles/`. Craft is the system name; physical names remain `crft.css` and `crft-manifest.json`. Project-owned `global.css` imports flat `tokens.css` and `crft.css`. The eight logical layers remain `reset`, `base`, `tokens`, `type`, `layout`, `grid`, `motion`, and `utility`. Replace or delete this copy when adopting another system. Existing sites receive no automatic CSS upgrade or compatibility aliases.

No font files ship. Text renders in `system-ui` until the project adds `@font-face` rules and WOFF/WOFF2 files under `src/styles/`. The build hashes those files and rewrites their URLs.

Use `.c` containers with optional `sm` or `lg` classes, and `.s` for vertical stacks only. Type roles are `.display`, `.h1`, `.h2`, `.h3`, `.lead`, `.body`, `.small`, `.label`, and `.caption`. Native `h4`–`h6` retain their semantics with `h3` styling. Use ordinary `font-weight`; do not add type modifier flags. Grids use `g` tracks, `c` column spans, `r` row spans, and `o` visual order; `l` clamps lines. `Section` keeps its `c` input for `sm` and `lg`. `Grid` keeps `cols`, `x`, `y`, and `order`, emitting `g`, `c`, `r`, and `o`.

`data-theme` accepts `invert`, `tone`, or `accent` and changes color only. `data-accent` routes semantic accents. Choose the document scheme with `color-scheme` on `:root`. Type, spacing, and radius recipes resolve at `:root` only; local final-role overrides belong on semantic owners. Horizontal flow, wrapping, and alignment belong in bounded project or component CSS. `data-scrub` remains opt-in with a static fallback and reduced-motion support.

Never put a class on `section`. Direct `main > section` elements need meaningful, nonempty, unique IDs. Other IDs need a fragment, relationship, or behavior purpose. Component and route styles remain optional. Use semantic descendants and bounded structure before adding classes. `.btn`, `.crd`, and `.lnk` remain project conventions. Do not invent framework tokens or utility classes.

Lenis smooth scrolling is optional and self-hosted. Set `"scroll": "lenis"` in `src/site.json` to include it. Set `"scroll": "native"` to exclude its bootstrap, CSS, vendor code, and shell configuration from `dist/`. Reduced-motion users always keep native scrolling.

## Verification

Run `bun run build` after structural edits and `bun run doctor -- --launch` before handoff. `check` fails only on renderer contracts; stylesheet count, non-deferred head scripts, and `@import` in emitted CSS warn under `--launch`. Launch mode rejects the placeholder URL, the 1×1 `og.png`, and the starter's name, description, and home title; never fabricate production values. Measure Lighthouse against `bun run preview` or the production origin, not `bun run dev`.

`vercel.json` ships with Vercel build settings and cache headers; only hashed `css|js|woff` assets are immutable.
