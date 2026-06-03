# Package/template split

**Status:** active  
**Date:** 2026-05-26

## Context

SANITIZE Boilerplate needs to start new client projects while still receiving framework updates. Folder copies alone drift; Git versioning helps source history, but client upgrades need a package boundary.

## Chosen

- Repo/package identity: `@snz/bp`, repo `sanitizestudio/snz-bp`
- CLI: `snz-bp dev`, `snz-bp build`, `snz-bp check`, `snz-bp doctor`, `snz-bp new`, `snz-bp migrate`
- Framework package owns build/dev/check/scaffold logic, router fallback, shared `lib/`, and docs
- Client project owns `src/`, `content/`, `media/`, `.pages.yml`, and local docs/context
- Starter lives in `templates/default/`
- Private local creator shim: `bun scripts/install-local-creator.ts` installs `create-snz-bp`
- Creator supports `create-snz-bp my-client` and `create-snz-bp .` for empty current directories
- Private creator rewrites template dependency from `workspace:*` to `file:<repo-root>` so generated projects install local `snz-bp` binary
- Build root is `process.cwd()` so package commands can run from a client project
- Package root is derived from script location for framework-owned fallbacks

## Why

Keeps client projects small and editable while framework behavior updates through `bun update @snz/bp` later. Avoids copying internal build files into every client.

## Consequences

- Do not assume source files live next to build scripts
- Build code must distinguish project root from package root
- Prefer package fallbacks for framework-owned files (`runtime/router.js`, `runtime/lib/`) when absent in client projects
- Templates are starter snapshots, not update mechanism
- Breaking file-shape changes require `snz-bp migrate` entries

## Verification

- Root: `bun run check`
- Template: `cd templates/default && bun ../../bin/snz-bp.ts check`
