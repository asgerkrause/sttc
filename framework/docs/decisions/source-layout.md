# Source layout

**Status:** active  
**Date:** 2026-06-03

## Context

Authoring source paths had drifted toward public output names: `src/assets/css`, `src/assets/js`, root `router.js`, and root `lib/`. That made framework source feel like a static file dump and blurred user-owned code versus runtime-owned code.

## Chosen

Use semantic source folders and keep public output stable:

```txt
src/
  app/        # site-authored browser code
  styles/     # tokens, reset, layout primitives, page-level styles
  images/     # public image masters owned by source
  videos/     # public video sources
  files/      # public raw files/downloads
  components/
  routes/
  templates/
  shell.html
  site.json

runtime/
  router.js
  lib/paths.js
```

Build output remains browser-facing and cache-friendly:

```txt
dist/assets/css/
dist/assets/js/
dist/assets/images/
dist/assets/videos/
dist/assets/files/
dist/router.js
dist/lib/paths.js
```

## Why

- Authoring paths describe ownership, not URL shape.
- `/assets/*` remains an output contract only.
- `runtime/` makes framework-owned client code explicit.
- `src/app.ts` leaves one obvious home for TypeScript-first site code; `src/app/` holds optional support modules/vendor files.
- `src/styles/` leaves one obvious home for global style primitives and tokens.
- Specific media roots keep future pipelines obvious without reusing `src/assets`.

## Compatibility

The build resolver still falls back to legacy paths where safe:

- `src/assets/js` → `src/app`
- `src/assets/css` → `src/styles`
- `src/assets/images` → `src/images`
- root `router.js` / `lib` → `runtime/router.js` / `runtime/lib`

New projects should use the semantic layout only.

## Consequences

- Docs and scaffolds must refer to `src/app`, `src/styles`, `src/images`, `src/videos`, `src/files`, and `runtime`.
- Generated public URLs do not change.
- CI should build both root and starter template to catch layout drift.
