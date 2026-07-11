# Class language

**Status:** active  
**Date:** 2026-06-19

## Context

SANITIZE Boilerplate favors semantic HTML, ARIA state, data attributes, and token-driven CSS. Classes are still useful for durable primitives and private component hooks, but verbose naming creates clutter and encourages wrapper-heavy markup.

## Chosen

Use short, full-word classes for durable object roles:

- `.container`, `.stack`, `.card`, `.cards`
- `.button`, `.buttons`, `.link`, `.links`
- `.media`, `.eyebrow`

Use compact attributes for token-bound responsive composition:

- layout: `[g]`, `[c]`, `[r]`, `[o]`
- type and rhythm: `[t]`, `[gp]`
- spacing: `[mg]`, `[mg-t/r/b/l/tb/lr]`, `[pd]`, `[pd-t/r/b/l/tb/lr]`

Values read large → medium → small. One value applies everywhere; two values set large and small; three values set large, medium, and small. Type values are `h0`–`h6`, `lg`, `md`, `sm`. Spacing values are `xl`, `lg`, `md`, `sm`, `xs`, `0`.

Keep `.t-lg`, `.t-md`, and `.t-sm` only as migration aliases. Weight and color utilities remain `.fw-*` and `.c-*`. Private hooks stay concise and component-owned, e.g. `.brg`, `.logo-mk`, `.logo-tx`, `.code-lb`, `.hero-pn`, `.stp`.

Use semantic elements, ARIA, and `data-theme` before adding classes for state or theme.

## Why

- Full words make object roles legible to humans and agents.
- Compact attrs keep responsive composition fast without turning classes into CSS declarations.
- Token-bound values prevent arbitrary utility sprawl.
- Semantic selectors keep markup truthful.
- Private hooks remain clear without BEM or wrapper naming debt.

## Consequences

- Legacy aliases `.c`, `.w`, `.crd`, `.btn`, `.btns`, `.lnk`, `.lnks`, `.img-w`, and `.eb` are not shipped.
- `.card` is a global primitive in `wrappers.css`; `Card` composes it.
- `utilities.css` owns responsive type and spacing attrs; attrs assign recipe variables and shared declarations consume them once.
- Component-specific selectors still belong in component `<style>` unless promoted to an approved primitive.

## Verification

- `bun run css:audit`
- `bun run doctor`
- `bun test`
