# Starter component scaffold

CSS packaging, hooks, token names, and font paths below record the historical pre-v3 state. Superseded by [Craft v3 adoption](./craft-v3-adoption.md) for those topics. The seven-component scaffold and creator boundary remain current.

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

`Section` provides `section > [c]`. Optional `c` flags are `sm`, `lg`, and `ct`. `Grid` maps `cols`, `x`, `y`, and `order` to CRFT `g`, `x`, `y`, and `o` attributes. `SEO` has no component file.

The starter copies pinned CRFT CSS (`7358c7e`) into project-owned `src/styles/`. Layers are `reset`, `base`, `tokens`, `type`, `layout`, `grid`, `motion`, and `utility`. The renderer does not own that presentation layer. Created sites keep their copy until they replace it.

## Fonts (2026-09, #14 and #20)

The template ships no font files: `layers/fonts.css`, `sans.woff`, and `mono.woff` are deleted from `templates/default/` and `global.css` does not import a fonts layer. `tokens.css` stays at the CRFT pin, so `--t-ff-sa` still names `"SNZ Sans"` first and a created site falls through to `system-ui`. A client site adds its own `@font-face` rules and WOFF/WOFF2 files under `src/styles/`. The studio faces are brand material, and shipping 550 KB of them to every client site was the wrong default.

The dogfood site keeps `layers/fonts.css` with the SNZ faces; it is the studio's own site.

## Dogfood site (2026-09, #20)

This repo's `src/` carries only the components its pages use: the seven starter components, with the dogfood `Header` adding navigation data and a sticky-header `<style>`. The extra components that lived there (`Accordion`, `Badge`, `Button`, `Card`, `FAQ`, `Link`, `Split`, `Statement`) were unused by any page and did not ship to created sites; they were deleted rather than maintained. A component library, if one comes, is #13.

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

`templates/default/` is the only creator source and ships inside `@byak/sttc`. `sttc create` copies it directly. There is no creator package, mirrored template, or synchronization step.

Components remain useful without JavaScript. Behavior, provider integrations, credentials, and business validation stay project-owned. The build writes each project's generated component contract to `.snz/components-catalog.md`.
