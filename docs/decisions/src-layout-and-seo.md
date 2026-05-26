# src layout and SEO

**Status:** active  
**Date:** 2026-05-23

## Context

Boilerplate had duplicate `index.html` (root + dist), `blocks/` naming, and 404 nested shell because dev server returned full shell for missing `/routes/*.html`.

## Options considered

1. **Keep root source files** — simpler paths, confusing duplicates
2. **`src/` + `dist/`** — clear author vs served artifact
3. **Runtime SEO** — rejected; build-time only for static boilerplate

## Chosen

- `src/` for all author files; `dist/` gitignored output only
- Rename blocks → **components**, PascalCase tags (`<Button … />`, `<SEO … />`)
- `site.json` + `seo` component for defaults and per-route overrides
- Dev server: missing `/routes/*` → **404**, not shell fallback

## Why

Clarity for clones, honest 404 behavior, one file for SEO defaults.

## Consequences

- Edit `src/` only; run `bun run build` or `bun run dev`
- Author with `<Button … />`, `<SEO … />` (not legacy `<component>` or comment directives)
- SEO optional on routes; defaults from slug + `site.json`
- Home route = **`src/routes/index.html`** → `/` (router slug `index`, not `home`)
- Routes: body-only in source; build emits **one** `<head>` in `dist/` (no double `<head>`)

## Links

- `.pi/domain.md`
