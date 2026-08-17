# Starter component scaffold

**Status:** active  
**Date:** 2026-08-17

## Decision

Created projects ship exactly seven replaceable HTML components:

- `Header`
- `Footer`
- `Section`
- `Logo`
- compiler-assisted `Image`
- `Video`
- `Grid`

`Section` provides `section > .c`. `Grid` maps `cols`, `span`, `rows`, and `order` to CRFT `g`, `c`, `r`, and `o` attributes. `SEO` is a renderer directive and has no component file.

The starter copies the pinned CRFT CSS into project-owned `src/styles.css`. The renderer does not own that presentation layer.

## Boundary

`templates/default/` is the only creator source and ships inside `@snz/sttc`. `sttc create` copies it directly. There is no creator package, mirrored template, or synchronization step.

Components remain useful without JavaScript. Behavior, provider integrations, credentials, and business validation stay project-owned. The build writes each project's generated component contract to `.snz/components-catalog.md`.
