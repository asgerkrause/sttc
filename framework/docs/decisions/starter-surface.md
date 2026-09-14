# Starter component scaffold

**Status:** active  
**Date:** 2026-08-20

## Decision

Created projects ship exactly seven replaceable HTML components:

- `Header`
- `Footer`
- `Section`
- `Logo`
- compiler-assisted `Image`
- `Video`
- `Grid`

`Section` provides `section > [c]`. Optional `c` flags are `sm`, `lg`, and `ct`. `Grid` maps `cols`, `x`, `y`, and `order` to CRFT `g`, `x`, `y`, and `o` attributes. `SEO` is a renderer directive and has no component file.

The starter copies pinned CRFT CSS (`7358c7e`) into project-owned `src/styles/`. Layers are `reset`, `base`, `tokens`, `type`, `layout`, `grid`, `motion`, and `utility`. Optional SNZ faces live in `layers/fonts.css` plus `sans.woff` and `mono.woff`. The renderer does not own that presentation layer. Created sites keep their copy until they migrate.

Dogfood `src/styles/` matches that pin except these brand overrides:

| Observed | CRFT `7358c7e` | Dogfood | Action |
| --- | --- | --- | --- |
| `--l-bl-x` | `2rem` | `calc(2vw + 1em)` | keep brand bleed |
| `--c-sw-li` | `#fbfbfa` | `#fff` | keep canvas |
| `--c-bc` | 25% mix | 15% mix | keep quieter border |
| `--c-mu` | 45% mix | 60% mix | keep stronger muted |
| heading `ls` / `fw` | `-0.01em`, regular | tighter tracking, `h1`/`h3`–`h6` bold | keep type voice |
| `color-scheme` | `light dark` | `light` | keep light-only dogfood |

## Boundary

`templates/default/` is the only creator source and ships inside `@snz/sttc`. `sttc create` copies it directly. There is no creator package, mirrored template, or synchronization step.

Components remain useful without JavaScript. Behavior, provider integrations, credentials, and business validation stay project-owned. The build writes each project's generated component contract to `.snz/components-catalog.md`.
