# Vercel deployment adapter

**Status:** active  
**Date:** 2026-06-19

## Context

STTC client sites deploy to Vercel. Framework defaults should make Bun builds, static output, caching, analytics hooks, and future deploy checks obvious without turning the renderer into a Vercel-only product.

## Chosen

Ship a first-class Vercel adapter surface:

- `vercel.json` in root and starter template
- `buildCommand`: `bun run build`
- `outputDirectory`: `dist`
- `installCommand`: `bun install`
- `devCommand`: `bun run dev`
- `bunVersion`: `1.x`
- immutable cache headers only for hashed `css|js|woff` paths under `/assets/css/` and `/assets/js/`; other `/assets/*` output revalidates (#19)
- short cache headers for discovery files
- component-level `track="Event name"` compiles to `data-snz-track="Event name"`
- runtime exposes `snz.track(event, data?)` and always emits `snz:track`; the project forwards to Vercel Analytics from `src/app.ts` (#14)

## Why

Vercel is the deployment default. The framework should own deploy contracts the same way it owns build contracts. `track="Contact CTA"` keeps authoring client-friendly and avoids JavaScript for common marketing events.

## Consequences

- Static sites remain static; no Vercel Functions or Routing Middleware by default.
- Analytics and Speed Insights require explicit Vercel setup before client sites load their scripts. `site.json` carries no Vercel flags.
- Custom events may require Vercel Pro/Enterprise; the runtime never calls `window.va` itself.
- `check` warns when an immutable rule matches unhashed media.
- Deployment concerns stay in adapter config/docs, not scattered through renderer internals.

## Verification

Use:

```bash
bun run check
bun test
bun run typecheck
```
