# Class language

**Status:** active  
**Date:** 2026-06-19

## Context

SANITIZE Boilerplate favors semantic HTML, ARIA state, data attributes, and token-driven CSS. Classes are still useful for durable primitives and private component hooks, but verbose naming creates clutter and encourages wrapper-heavy markup.

## Chosen

Use classes rarely and keep them short.

Global primitives:

- `.c` — container
- `.w` — wrap / vertical rhythm
- `.crd` — card surface
- `.btn` — action button
- `.btns` — action group
- `.lnk` — text link
- `.lnks` — link group

Type/tone utilities:

- `.eb` — eyebrow / kicker
- `.t-lg`, `.t-md`, `.t-sm`
- `.fw-l`, `.fw-r`, `.fw-b`
- `.c-ink`, `.c-mut`, `.c-bg`, `.c-acc`, `.c-sec`
- `.h0`…`.h6`

Private hooks stay concise and component-owned, e.g. `.brg`, `.logo-mk`, `.logo-tx`, `.code-lb`, `.hero-pn`, `.stp`.

Use semantic elements, ARIA, and `data-theme` before adding classes for state or theme.

## Why

- Short primitives keep authoring fast.
- Semantic selectors keep markup truthful.
- Private hooks remain clear without BEM or wrapper naming debt.
- The class contract trains humans and agents toward the same style.

## Consequences

- `.card`, `.burger`, `.eyebrow`, `.step`, `.section-head`, `.logo-mark`, `.logo-text`, `.code-lang`, and `.hero-panel` are replaced by `.crd`, `.brg`, `.eb`, `.stp`, semantic `<header class="w">`, `.logo-mk`, `.logo-tx`, `.code-lb`, and `.hero-pn`.
- `.crd` is a global primitive in `wrappers.css`; `Card` composes it.
- Component-specific selectors still belong in component `<style>` unless promoted to an approved primitive.

## Verification

- `bun run css:audit`
- `bun run doctor`
- `bun test`
