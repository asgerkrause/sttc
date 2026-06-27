# CSS token system

**Status:** active  
**Date:** 2026-06-19

## Context

The framework CSS had grown into one large `src/styles.css` file with static size tokens, `--gg`/`--gp` naming drift, and generic body aliases (`--fs`, `--fw`, `--ls`, `--lh`, `--fmw`). Component ownership was already correct, but token authoring needed a smaller human/agent surface.

## Chosen

Global CSS is split by owner:

- `src/styles.css` — import shell and layer order only
- `src/styles/system.css` — editable token config, fluid engine, color/theme tokens
- `src/styles/reset.css` — reset and base element rules
- `src/styles/grid.css` — `[g]`, `[c]`, `[r]`, `[o]`
- `src/styles/type.css` — heading/body utility type rules
- `src/styles/wrappers.css` — `.c`, `.w`, `.btns`, `.lnks`, tiny global wrappers
- `src/styles/motion.css` — scroll/view-transition hooks

Token naming uses short stable primitives:

- layout: `--mw`, `--px`, `--py`, `--ss`, `--gp`, `--pd`, `--br`, `--bw`, `--gc`
- type: `--fw-l`, `--fw-r`, `--fw-b`, plus `--md-fs/fw/ls/lh/mw`, `--lg-*`, `--sm-*`, `--h0-*`…`--h6-*`
- color config: `--l`, `--d`, `--a`, `--ai`, `--c`, `--ci`
- semantic color output: `--s`, `--i`, `--t`, `--b`, `--g`

`--gp` is the only global gap token. `--gg` is not used.

Themes remap semantic tokens. Accent sections use `data-theme="accent"`; no swatches or `[data-accent]` API ships by default.

## Why

- A tiny editable config is easier for humans and agents than verbose token soup.
- Fluid `*-min` / `*-max` tokens make marketing sites feel polished without per-breakpoint overrides.
- Semantic color outputs keep components portable across `tone`, `accent`, and `invert` themes.
- Splitting CSS by owner lowers scan cost without adding a runtime dependency or utility framework.

## Consequences

- Component CSS should consume semantic/layout tokens, not raw hex or one-off spacing.
- Theme packs must override the new token contract (`--mw-max`, `--md-*`, `--l`, `--d`, etc.).
- Docs should teach the token legend instead of every derived ramp.
- Existing custom code using `--gg`, `--fs`, `--fw`, `--a-i`, or `--c-i` should migrate to `--gp`, `--md-*`, `--fw-l/r/b`, `--ai`, and `--ci`.

## Verification

- `bun run doctor`
- `bun test`
