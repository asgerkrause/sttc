---
name: snz-launch
description: Use when preparing a SANITIZE site for preview, production deployment, or client handoff.
---
<!-- @snz-skill snz-launch e92bc18ddbc13b69a5ba99481fea34ab22585ae34e071037ae46e7a0717490e2 -->

# SANITIZE Launch

## Principle

A passing build is not launch approval. Production readiness combines deterministic checks with human review of content, accessibility, metadata, and deployment configuration.

## Workflow

1. Read `AGENTS.md` and inspect `src/site.json`, `vercel.json`, routes, the 404 page, navigation, and public media sources.
2. Confirm the production HTTPS URL, locale, site description, OG source, page titles/descriptions, internal links, and intended canonical paths.
3. Review image alternatives by meaning: informative images need useful alt text; decorative images use `alt=""`.
4. Run the gates in order:
   - `bun run check`
   - `bun run doctor`
   - `bun run doctor -- --launch`
5. Fix source only and repeat the failing gate. Never patch `dist/`.
6. Return a report grouped as blockers, warnings, and human-review items. Stop at readiness evidence unless deployment was explicitly requested through an approved deployment workflow.

## Blockers

- Placeholder or non-HTTPS production URL.
- Missing required metadata, OG source/output, route, asset, or accessible name.
- Broken internal links or route collisions.
- Any non-zero launch gate.
- Unknown deployment build command or output directory.

Warnings are not automatic blockers, but each needs a named disposition. Do not waive accessibility, canonical, or content problems because a deadline is near.

## Evidence to return

- Exact commands and exit results.
- Blockers, warnings, and human-review items with owning source paths.
- Deployment configuration checked and whether the site is ready, not ready, or ready with accepted warnings.
