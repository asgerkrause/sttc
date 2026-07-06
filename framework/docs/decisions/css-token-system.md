# CSS token system

**Status:** active  
**Date:** 2026-07-02

## Context

The framework CSS needs a token contract that is explicit enough for human editing and agent work. The new contract follows the grouped `test-system-3_5` naming model and ships no short aliases.

## Chosen

Global CSS is split by owner:

- `src/styles.css` — import shell and layer order only
- `src/styles/system.css` — editable token config, fluid engine, color/theme tokens
- `src/styles/reset.css` — reset and base element rules
- `src/styles/grid.css` — `[g]`, `[c]`, `[r]`, `[o]`
- `src/styles/type.css` — heading/body utility type rules
- `src/styles/wrappers.css` — `.c`, `.w`, `.crd`, `.btns`, `.lnks`, tiny global wrappers
- `src/styles/motion.css` — scroll/view-transition hooks

Token naming uses grouped prefixes from `test-system-3_5`. Layout/type keep `snz-bp` fluid authoring; colors keep the #99 visual anchors with grouped names; theme mechanics and motion timing follow the `test-system-3_5` contract:

- layout: `--l-mw`, `--l-mw-min/max`, `--l-gc`, `--l-st`
- space: `--s-px`, `--s-py`, `--s-ss`, `--s-gp`, `--s-pd`, `--s-br`, `--s-bw`, plus `*-min/max` and grouped scale tokens (`--s-gp-sm`, `--s-pd-lg`, `--s-br-pill`)
- type: `--t-fw-l/r/b`, `--t-ff-*`, `--t-md-*`, `--t-lg-*`, `--t-sm-*`, `--t-h0-*`…`--t-h6-*`; fluid font sizes use names like `--t-h1-fs-min`, `--t-h1-fs-max`; line-height uses fixed tokens like `--t-h1-lh` and is never clamped
- color: anchors `--c-light-fixed`, `--c-dark-fixed`, `--c-acc`, `--c-sec`; semantic roles `--c-bg`, `--c-fg`, `--c-ink`, `--c-sur`, `--c-mut`, `--c-bor`; paired roles `--c-acc-sur/ink/bor`, `--c-sec-sur/ink/bor`; ramps `--c-neu-*`, `--c-acc-*`, `--c-sec-*`, `--c-bg-*`, `--c-fg-*`
- motion/state: `--m-td*`, `--m-tf*`, `--i-hov-*`, `--i-foc-*`, `--i-prs-*`, `--i-exp-*`
- element roles: `--e-head-*`, `--e-foot-*`, `--e-btn-*`, `--e-crd-*`, `--e-inp-*`, `--e-bdg-*`

Old short tokens are not shipped. CSS must use grouped tokens.

Themes remap semantic color tokens. Use `data-theme="tone"`, `data-theme="accent"`, `data-theme="secondary"`, or `data-theme="invert"` for scoped themes.

## Why

- Grouped prefixes make role and ownership obvious without adding a dependency or utility framework.
- Fluid `*-min` / `*-max` tokens preserve polished marketing rhythm without per-breakpoint overrides.
- Semantic color outputs keep components portable across `tone`, `accent`, `secondary`, and `invert` themes.
- Removing aliases makes the token contract explicit; downstream custom CSS must migrate to grouped names.
- Splitting CSS by owner lowers scan cost while preserving component style ownership.

## Consequences

- Component CSS should consume grouped semantic/layout tokens, not raw hex or one-off spacing.
- Theme packs should override grouped config tokens (`--l-mw-max`, `--t-md-*`, `--c-acc`, etc.).
- Docs teach grouped tokens only.
- Existing custom CSS using short tokens must migrate to grouped names.

## Verification

- `bun run css:audit`
- `bun run doctor`
- `bun test`
