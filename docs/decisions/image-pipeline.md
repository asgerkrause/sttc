# Image pipeline (Bun.Image)

**Status:** active  
**Date:** 2026-05-24

## Context

Assets were copied raw (`cp src/assets → dist/assets`). No raster files in repo; `site.json` referenced missing `/assets/og.png`. No npm image toolchain.

## Options considered

1. **sharp / imagemin** — mature, extra deps and native install friction  
2. **Runtime resize in `dev.ts`** — complicates static deploy; not v1  
3. **`Bun.Image` at build time** — zero npm deps, matches Bun-only stack

## Chosen

- Masters in `src/images/` and CMS uploads in `media/images/` (jpg/png/webp)
- `images.ts` runs from build via `Bun.Image` → webp variants (and OG png fallback)
- `dist/assets/images/*.webp` + responsive `-{width}.webp` variants + `dist/assets/og.webp` served as static files
- Requires **Bun >= 1.3.14** (`Bun.Image`)

## `<Image />` component

- `src/components/Image.html` — `.img-w` wrapper + single `<img>`
- Route: `<Image src="hero" alt="…" />` (`src` = logical name, no extension)
- Build maps `src` → `/assets/images/{name}.webp` and dimensions from `metadata()`
- Optional encode attrs: `max="1200"` `quality="82"` (quoted integers)
- Pre-scan (`scan-images.ts`) of shell, routes, components before `processImages`
- Same `src` on multiple tags: build uses **max** of each attr per name
- Cache: `dist/assets/images/.meta/{name}.json` — re-encode when master mtime or encode params change
- Warn when master dimension > 4000px

## Lazy preview (`.img-tmp`)

- Default `loading="lazy"` → `.img-tmp` (Bun `placeholder()` data URL) over `.img-main`; main stays opacity 1; tmp absolute; parallax matches main in `@supports (animation-timeline: view())`
- `image-preview.js` removes `.img-tmp` on main `load` / `error` (no inline handlers)
- `loading="eager"` → single `<img>`, no tmp
- Optional pixelated tmp: `image-rendering: pixelated` on `.img-tmp` in `Image.html`
- Output format: **webp** for dist rasters
- Responsive `srcset` emits for generated variants unless `responsive="false"`

## Out of scope

- AVIF output
- Runtime `Bun.serve` transforms
- Rewriting arbitrary `<img src="hero.jpg">` in routes
- Remote media URL ingest

## Author workflow

1. Add `src/images/{name}.jpg` (or png)
2. `bun run build`  
3. `<Image src="{name}" alt="…" />` in routes (or manual `/assets/images/{name}.webp`)  
4. OG: `src/images/og.png` → `dist/assets/og.webp` + `og.png`; default in `site.json` is `/assets/og.webp`
