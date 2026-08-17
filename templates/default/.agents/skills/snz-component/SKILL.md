---
name: snz-component
description: Use when adding or changing an STTC build-time component or composing the seven starter components.
---
<!-- @snz-skill snz-component 999a226538e97e6f5a25a242f77947babd55093b662081c3dc2915fcda181b92 -->

# SANITIZE Component

## Principle

Keep components atomic, semantic, source-owned, and replaceable. The renderer supplies compilation; the project supplies presentation.

## Workflow

1. Read `AGENTS.md`, then the installed framework `framework/docs/framework/05-components.md` and generated catalog when available.
2. Search `src/components/` and route usage. Reuse `Header`, `Footer`, `Section`, `Logo`, `Image`, `Video`, or `Grid` when the contract matches.
3. Otherwise scaffold one component with `bun run new component <PascalName>`.
4. Keep the leading schema, semantic markup, slots, optional lifecycle script, and optional component style in one file.
5. Use attrs for content, state, labels, IDs, and small purposeful variants. Do not create a prop per CSS declaration.
6. Follow the project's CSS system when styles are requested; SANITIZE ships no token or utility framework.
7. Add runtime code only when native HTML cannot own the behavior. Return cleanup and guard active work with `snz.onActive` or `snz.onVisible`.
8. Never edit `dist/` or the generated component catalog. Run `bun run build`.

## Stop conditions

- A retained or local component already matches: reuse it.
- Route, content, accessibility, or data intent is unknown: ask before inventing it.
- A dependency or runtime framework is proposed without explicit authority.
- A command fails: follow its source file, line, and hint.

## Evidence

Return the component boundary, public attrs, changed files, and exact verification result.
