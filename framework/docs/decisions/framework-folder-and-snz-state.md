# Framework folder and .snz state

**Status:** active  
**Date:** 2026-06-25

## Context

The framework repo root had many implementation folders (`build/`, `runtime/`, `bin/`, `scripts/`, `tests/`, `types/`) beside the authoring `src/` tree. That made day-to-day site work and agent routing noisier than needed.

No external users depend on the old file shape yet, so this is the right time for a clean break.

## Chosen

- Framework internals live under `framework/`:
  - `framework/cli/`
  - `framework/build/`
  - `framework/runtime/`
  - `framework/scripts/`
  - `framework/tests/`
  - `framework/types/`
- Site authoring remains visible under `src/` and optional `content/`.
- Client starters do not copy framework internals.
- `.snz/` is reserved for local cache/state only.
- Do not put source code, templates, content, or copied framework files in `.snz/`.

## Why

Cleaner DX for humans and agents: authoring work targets `src/`; engine work targets `framework/`; starter work targets `templates/default/`; creator work targets `packages/create-snz-bp/`.

## Consequences

- CLI/package paths point at `framework/cli/snz-bp.ts`.
- Build/dev code must distinguish project root (`process.cwd()`) from framework root (derived from script location).
- Workspace authoring mode can hide `framework/` without hiding authored source.
- Docs and tests must use `framework/` paths for engine-owned files.

## Verification

- `bun run typecheck`
- `bun run test`
- `bun run check`
- `bun run doctor`
- `bun run check:create-template`
- `bun run smoke:create`
