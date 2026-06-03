# bunfig conventions

## Decision

Do not add a project-level `bunfig.toml` yet.

## Why

Current framework behavior is clearer when owned by code and package scripts:

- Tests run with plain `bun test`; no custom runner defaults are needed.
- Coverage options are not settled yet.
- Workspace/install behavior works without extra Bun config.
- Frontend env handling is intentionally owned by the app bundler: `build/extract-js.ts` only inlines `PUBLIC_*` values into browser code.

Adding `bunfig.toml` now would create config surface without reducing author or framework complexity.

## Revisit when

- Coverage becomes a CI contract.
- Test defaults need shared preload/setup behavior.
- Workspace install behavior needs explicit pinning.
- Public frontend env conventions outgrow the current `PUBLIC_*` bundler allowlist.

## Verification

Keep using:

```bash
bun test
bun run doctor
```
