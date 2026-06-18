# Publish checklist

Use when publishing `@snz/bp` and `create-snz-bp`.

## Private review guard

This repo is intentionally unpublished for now. Package manifests must keep `"private": true` during private review. Do not remove it, add publish config/scripts, change npm access, or publish until a human makes an explicit release decision.

Run `bun run check:private` before release-adjacent work. It fails if root, creator, or starter-template package manifests drift away from private review invariants.

## Preflight

- [ ] Run `bun run check:private` and confirm private review guard passes before changing release gates.
- [ ] Confirm a human approved moving out of private review.
- [ ] Remove `"private": true` from root `package.json` and `packages/create-snz-bp/package.json` only after that approval.
- [ ] Confirm `package.json` version matches `packages/create-snz-bp/package.json`.
- [ ] Run `bun run prepare:create-template` so `packages/create-snz-bp/template/default` matches `templates/default`.
- [ ] Run `bun run check:create-template`.
- [ ] Run `bun test`.
- [ ] Run `bun run doctor`.
- [ ] Run `cd templates/default && bun ../../bin/snz-bp.ts doctor`.
- [ ] Run `bun run smoke:create` (local creator install/check, packaged-template check, `create-snz-bp .`).
- [ ] Inspect packed files:
  - [ ] `bun pm pack --dry-run` from repo root.
  - [ ] `cd packages/create-snz-bp && bun pm pack --dry-run`.

## Human gates

- [ ] Confirm npm account/org access for `@snz/bp` and `create-snz-bp`.
- [ ] Confirm npm publish access mode for scoped `@snz/bp` (`--access public` if public). Do not change access before approval.
- [ ] Confirm provenance/2FA requirements for both package publishes.
- [ ] Confirm `UNLICENSED` is intentional before public publish, or replace with approved license.
- [ ] Confirm version, release notes, and git tag for release.

## Publish order

1. Publish `@snz/bp`.
2. Publish `create-snz-bp` with matching version.
3. Smoke published create flow in a temp directory:

```bash
bun create snz-bp my-site
cd my-site
bun install
bun run check
```

## Safety

- Keep `"private": true` in root, creator, and starter-template package manifests until human release approval; this blocks accidental `npm publish`/`bun publish` from private review.
- Keep `publishConfig` and publish lifecycle scripts absent during private review.
- Never publish with `file:` or `workspace:*` dependencies in generated templates.
- The creator uses `file:<repo-root>` only in local monorepo mode.
- Published creator uses its packaged template and writes `@snz/bp` as the matching semver range.
