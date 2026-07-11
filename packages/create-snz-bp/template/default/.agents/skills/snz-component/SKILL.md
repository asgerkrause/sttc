---
name: snz-component
description: Use when adding or changing a SANITIZE component, choosing between built-ins, presets, composition, and a custom component.
---
<!-- @snz-skill snz-component a2b53e6def0ef43fe8b7ee70506e2d445ee6d30de161d7aa59aff717e0c97e4e -->

# SANITIZE Component

## Principle

Reuse before extraction. The CLI owns predictable scaffolding; the agent owns component boundaries, schema design, composition, and verification.

## Workflow

1. Read `AGENTS.md`, then `node_modules/@snz/bp/framework/docs/components.md` and `framework/docs/components-catalog.md` when available.
2. Search `src/components/` and route usage. Choose, in order:
   - compose existing built-ins;
   - install a matching preset with `bun run add component <preset>`;
   - scaffold one custom component with `bun run new component <PascalName>`.
3. Reject prop-per-style APIs. Attributes describe content, state, or a small purposeful `variant`; tokens and responsive attributes own visual composition.
4. Keep the contract, semantic markup, component CSS, and optional lifecycle script in `src/components/<PascalName>.html`.
5. Keep component selectors in its `<style>`. Use existing tokens and full-word primitives. Add runtime code only for behavior HTML/CSS cannot own; return cleanup from component scripts.
6. Update only the intended route or parent component. Never edit `dist/` or the generated component catalog.
7. Run `bun run build`. Run `bun run doctor` when CSS ownership or launch-sensitive behavior changes.

## Stop conditions

- The requested component already exists: reuse it and explain the match.
- The destination route or content contract is unknown: ask before inventing usage.
- The request needs raw colors, arbitrary spacing props, a runtime framework, or a dependency: challenge it against the token and native-platform contracts.
- A command fails: follow its file, line, and hint; do not patch generated output.

## Evidence to return

- Reused built-in, selected preset, or reason a custom boundary was earned.
- Files changed and public attributes added.
- Exact verification commands and results.
