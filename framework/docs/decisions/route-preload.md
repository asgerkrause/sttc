# Route preload cache

**Status:** superseded 2026-09. Navigation is native (#14, #16): the runtime fetches no route HTML, and prefetch comes from a `<script type="speculationrules">` block in `src/shell.html`. See `framework/docs/framework/runtime.md`.  
**Date:** 2026-05-24

## Context

Router already injected `<link rel="prefetch">` on every `mouseover` with no dedupe. `render()` always refetched route HTML on click, so prefetch did not make navigation feel instant.

## Chosen

- In-memory cache of route HTML keyed by the route fragment URL
- Intent preload: `mouseover` + `focusin` after 100ms; cancel on leave/blur (`mouseover`/`mouseout` bubble — `pointerenter`/`pointerleave` do not, so document delegation requires mouse events)
- `touchstart` preload (no delay) for tap navigation
- Skip: current URL, `data-snz-preload="off"`, `download`, non-`_self` targets, `navigator.connection.saveData`
- `render()` reads cache first; in-flight requests deduped

## Why

SvelteKit-style snappiness without a framework. SEO unchanged (client-only). Keyboard users get `focusin`. Metered connections respected.

## Consequences

- Stale cache until full page reload (acceptable for static HTML; dev edits need refresh)
- No per-link preload modes beyond `data-snz-preload="off"`
