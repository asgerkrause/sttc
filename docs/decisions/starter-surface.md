# Starter surface vs framework demo

**Status:** active  
**Date:** 2026-05-26

## Context

`create-snz-bp` copied the full framework repo `src/`, so new client projects inherited studio demo routes (`about`, `contact`, game image, etc.).

## Chosen

| Surface | Purpose |
| ------- | ------- |
| Repo root `src/` | Internal dogfood — keep studio demo routes |
| `templates/default/` | Only files shipped by `create-snz-bp` |

Starter routes:

- `/` — generic landing with built-in component samples
- `/components/` — full component gallery
- `/404` — not found

Starter nav: Home + Components only (template `Header.html` override).

Do **not** sync template with `cp -R src`. Curate `templates/default/` by hand.

## Why

Clients start clean. Framework repo keeps realistic demo for development.

## Consequences

- Template may override `Header.html` while root keeps studio nav
- Template drops demo posts/images; root keeps them
- Footer year is client-rendered in all projects using `Footer`

## Verification

```bash
bun run check
cd templates/default && bun ../../bin/snz-bp.ts check
create-snz-bp /tmp/bp-starter-test && cd /tmp/bp-starter-test && bun install && bun run check
```
