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
- immutable cache headers for `/assets/*`
- short cache headers for discovery files
- `site.json.vercel.analytics` and `site.json.vercel.speedInsights` are advisory flags for docs/checks, not automatic script injection
- component-level `track="Event name"` compiles to `data-snz-track="Event name"`
- runtime exposes `snz.track(event, data?)` and emits `snz:track` when Vercel Analytics is not loaded

## Why

Vercel is the deployment default. The framework should own deploy contracts the same way it owns build contracts. `track="Contact CTA"` keeps authoring client-friendly and avoids JavaScript for common marketing events.

## Consequences

- Static sites remain static; no Vercel Functions or Routing Middleware by default.
- Analytics and Speed Insights require explicit Vercel setup before client sites load their scripts.
- `site.json.vercel.*` can document intent and let future `doctor` checks warn about missing setup, but build output stays unchanged.
- Custom events may require Vercel Pro/Enterprise; the runtime helper no-ops/fires `snz:track` when unavailable.
- Deployment concerns stay in adapter config/docs, not scattered through renderer internals.

## Verification

Use:

```bash
bun run check
bun test
bun run typecheck
```
